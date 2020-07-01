import math, sys
import service_utils, queries as tezos
from microseil import BakerPerformance

SAMPLE_RANGE = 1

def calculate_grade(baker, current_cycle):
    print(baker)
    start_cycle = current_cycle - SAMPLE_RANGE;
    delegate = tezos.baker_info_at_level(baker, tezos.cycle_to_level(current_cycle))
    staking_balance = tezos.utez_to_tez(int(delegate["staking_balance"]))
    num_delegators = len(delegate["delegated_contracts"])

    blocks_baked = tezos.blocks_baked_between(baker, start_cycle, current_cycle)
    blocks_stolen =  tezos.blocks_stolen_between(baker, start_cycle, current_cycle)
    blocks_missed = tezos.blocks_missed_between(baker, start_cycle, current_cycle)

    num_blocks_baked = len(blocks_baked)
    num_blocks_stolen = len(blocks_stolen)
    num_blocks_missed = len(blocks_missed)

    num_endorsements_in_baked = tezos.sum_endorsements_for_blocks(blocks_baked)
    num_endorsements_in_stolen = tezos.sum_endorsements_for_blocks(blocks_stolen)
    num_endorsements_in_missed = tezos.sum_endorsements_for_blocks(blocks_missed)

    blocks_per_stake = 0 if staking_balance==0 else float(num_blocks_baked/staking_balance)
    grade = (100000 * blocks_per_stake) * \
        (num_blocks_baked+num_blocks_stolen)/(1+num_blocks_baked) * \
        (math.exp(-1* (num_blocks_missed/(num_blocks_baked+1))))*(1-(1/(1+num_delegators)))
    #   try this:    grade =  (100000 * num_blocks_per_stake) * (num_blocks_baked+5*s)/(1+num_blocks_missed+num_blocks_baked) *(1-(1/(1+d)))
    row = BakerPerformance(baker=baker, cycle=current_cycle,
                           num_baked=num_blocks_baked,
                           num_stolen=num_blocks_stolen,
                           num_missed=num_blocks_missed,
                           num_endorsements_in_baked=num_endorsements_in_baked,
                           num_endorsements_in_stolen=num_endorsements_in_stolen,
                           num_endorsements_in_missed=num_endorsements_in_missed,
                           grade=grade)
    return row

@service_utils.populate_from_cycle()
def calculate_grades_for_cycle(cycle):
    print("Calculating grades for cycle %s..." % cycle)
    start_cycle = cycle - SAMPLE_RANGE
    bakers = tezos.active_bakers_between(start_cycle, cycle)
    data = []
    for baker in bakers:
        data.append(calculate_grade(baker, cycle))
    return data
        
    
        
