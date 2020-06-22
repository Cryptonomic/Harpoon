import postgres, service_utils, queries as tezos
import math, sys

TABLE = "baking_info.baker_grades"
COLUMNS = ("address", "grade", "cycle")
SAMPLE_RANGE = 10

def calculate_grade(baker, current_cycle):
    start_cycle = current_cycle - SAMPLE_RANGE;
    delegate = tezos.baker_info_at_level(baker, tezos.cycle_to_level(current_cycle))
    staking_balance = tezos.utez_to_tez(int(delegate["staking_balance"]))
    num_delegators = len(delegate["delegated_contracts"])

    blocks_baked = tezos.blocks_baked_between(baker, start_cycle, current_cycle)
    blocks_stolen = tezos.blocks_stolen_between(baker, start_cycle, current_cycle)
    blocks_missed = tezos.blocks_missed_between(baker, start_cycle, current_cycle)

    blocks_per_stake = 0 if staking_balance==0 else float(blocks_baked/staking_balance)

    grade = (100000 * blocks_per_stake) * \
        (blocks_baked+blocks_stolen)/(1+blocks_baked) * \
        (math.exp(-1* (blocks_missed/(blocks_baked+1))))*(1-(1/(1+num_delegators)))
#   try this:    grade =  (100000 * blocks_per_stake) * (blocks_baked+5*s)/(1+blocks_missed+blocks_baked) *(1-(1/(1+d)))
#   return baker, grade, blocks_per_stake, blocks_baked, s, m, d, staking_balance
    return baker, grade, current_cycle

@service_utils.populate_from_cycle(TABLE, COLUMNS)
def calculate_grades_for_cycle(cycle):
    print("Calculating grades for cycle %s..." % cycle)
    start_cycle = cycle - SAMPLE_RANGE
    bakers = tezos.active_bakers_between(start_cycle, cycle)
    data = []

    for baker in bakers:
        data.append(calculate_grade(baker, cycle))
    return data
    
    
        
