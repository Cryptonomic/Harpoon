import requests, json
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
PRESERVED_CYCLES = 5
PRESERVED_CYCLES = 5
SNAPSHOT_BLOCKS = 256
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

def all_bakers():
    return  delegates.query(delegates.pkh).order_by(delegates.staking_balance.desc()) \
                                          .filter(delegates.deactivated==False) \
                                          .limit(1000).vector()

def active_bakers_between(start_cycle, end_cycle):
        return list(set(blocks.query(blocks.baker) \
                        .filter(blocks.meta_cycle.between(start_cycle, end_cycle)) \
                        .vector()))

def baker_info_at_level(baker, level):
    response = requests.get("%s/chains/main/blocks/%s/context/delegates/%s" % (BASE_URL, level, baker));    
    return (json.loads(response.text))

def snapshot_index(cycle):
    cycleLevel = cycle_to_level(cycle) + 1
    r = requests.get("%s/chains/main/blocks/%d/context/raw/json/cycle/%d/roll_snapshot" % (BASE_URL, cycleLevel, cycle)) 
    return int(r.text)
    
