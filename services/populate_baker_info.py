import postgres
import math, time, sys, requests, json
from conseil.api import ConseilApi
from conseil.core import ConseilClient as Client

conseil = Client(ConseilApi(
    api_key='galleon',
    api_host='https://conseil-prod.cryptonomic-infra.tech:443',
    api_version=2
))

accounts= conseil.tezos.mainnet.accounts
blocks = conseil.tezos.mainnet.blocks
delegates = conseil.tezos.mainnet.delegates
baking_rights = conseil.tezos.mainnet.baking_rights

BASE_URL = "http://157.245.219.171:8732/"
CYCLE_SIZE = 4096
SAMPLE_RANGE = 10
MAX_LIMIT = 100000000

def utez_to_tez(num):
    return num / 1000000

def cycle_to_level(cycle):
    return cycle * CYCLE_SIZE

def current_cycle():
    return int(blocks.query(blocks.meta_cycle) \
               .order_by(blocks.level.desc()) \
               .limit(1) \
               .scalar())

def current_level():
    return int(blocks.query(blocks.level) \
               .order_by(blocks.level.desc()) \
               .limit(1) \
               .scalar())

def blocks_baked_between(baker, start_cycle, end_cycle):
    return int(blocks.query(blocks.hash, blocks.hash.count()) \
                      .filter(blocks.baker==baker,
                              blocks.meta_cycle.between(start_cycle, end_cycle))\
                      .scalar())

def blocks_stolen_between(baker, start_cycle, end_cycle):
    return int(blocks.query(blocks.hash, blocks.hash.count()) \
                 .filter(blocks.baker==baker,
                         blocks.priority>0, \
                         blocks.meta_cycle.between(start_cycle, end_cycle))\
                 .scalar())

def blocks_missed_between(baker, start_cycle, end_cycle):
    rights = baking_rights.query(baking_rights.level) \
                          .filter(baking_rights.delegate==baker,
                                  baking_rights.priority==0,
                                  baking_rights.cycle.between(start_cycle, end_cycle)) \
                          .order_by(baking_rights.level.asc()) \
                          .limit(MAX_LIMIT) \
                          .vector()

    return int(blocks.query(blocks.hash, blocks.hash.count()) \
                 .filter(blocks.level.in_(*rights),
                         blocks.baker!=baker) \
                 .limit(MAX_LIMIT) \
                 .scalar())

def active_bakers_between(start_cycle, end_cycle):
        return list(set(blocks.query(blocks.baker) \
                        .filter(blocks.meta_cycle.between(start_cycle, end_cycle)) \
                        .vector()))

def baker_info_at_cycle(baker, cycle):
    level = cycle_to_level(cycle)
    response = requests.get("%s/chains/main/blocks/%s/context/delegates/%s" % (BASE_URL, level, baker));    
    return (json.loads(response.text))


def calculate_grade(baker, current_cycle):
    start_cycle = current_cycle - SAMPLE_RANGE;
    delegate = baker_info_at_cycle(baker, current_cycle)
    staking_balance = utez_to_tez(int(delegate["staking_balance"]))
    num_delegators = len(delegate["delegated_contracts"])

    blocks_baked = blocks_baked_between(baker, start_cycle, current_cycle)
    blocks_stolen = blocks_stolen_between(baker, start_cycle, current_cycle)
    blocks_missed = blocks_missed_between(baker, start_cycle, current_cycle)

    blocks_per_stake = 0 if staking_balance==0 else float(blocks_baked/staking_balance)

    grade = (100000 * blocks_per_stake) * \
        (blocks_baked+blocks_stolen)/(1+blocks_baked) * \
        (math.exp(-1* (blocks_missed/(blocks_baked+1))))*(1-(1/(1+num_delegators)))
#   try this:    grade =  (100000 * blocks_per_stake) * (blocks_baked+5*s)/(1+blocks_missed+blocks_baked) *(1-(1/(1+d)))
#   return baker, grade, blocks_per_stake, blocks_baked, s, m, d, staking_balance
    return baker, grade, current_cycle

def calculate_grades_for_cycle(cycle):
    start_cycle = cycle - SAMPLE_RANGE
    bakers = active_bakers_between(start_cycle, cycle)
    data = []

    for baker in bakers:
        data.append(calculate_grade(baker, cycle))
    db = postgres.getLogin()
    postgres.push(db, "baking_info.test_baker_grades", ("address", "grade", "cycle"), data);

def populate(starting_cycle):
    cycle = starting_cycle
    while (True):
        latest_cycle = current_cycle()
        print("Checking cycle")
        if cycle > latest_cycle:
            level = current_level()
            end_of_cycle_level = cycle_to_level(latest_cycle+1)
            time_to_sleep = (end_of_cycle_level - level) * 40
            print("Up to date. %s blocks until next cycle" % (end_of_cycle_level - level))
            print("Sleeping for %s seconds." % time_to_sleep)
            time.sleep(time_to_sleep)
        else:
            print("Calculating grades for cycle %s..." % cycle)
            calculate_grades_for_cycle(cycle)
            print("Done")
            cycle += 1

if __name__ == "__main__":
    if len(sys.argv) == 2:
        populate(int(sys.argv[1]));
    else:
        print("Please specify a cycle to start sync from")
    
        
