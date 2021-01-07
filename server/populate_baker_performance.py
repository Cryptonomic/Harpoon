import math
import statistics
import service_utils
import queries as tezos
from microseil import BakerPerformance, get_session
from populate_grades import populate_grades

# Size of the range in cycles to use in pulling performance data.
SAMPLE_RANGE = 0

def get_baker_performance(baker, current_cycle):
    """Makes the necessary queries to accumulate baker performance data

    Args:
        baker: (String) address of baker to query
        current_cycle: (int) cycle to get performance data for

    Returns:
        (BakerPerformance) Wrapper class for baking_info table with necessary
        columns filled out. See microseil.BakerPerformance for column
        descriptions
    """

    start_cycle = current_cycle - SAMPLE_RANGE
    delegate = tezos.baker_info_at_level(baker, tezos.cycle_to_level(current_cycle))
    staking_balance = tezos.utez_to_tez(int(delegate["staking_balance"]))
    num_delegators = len(delegate["delegated_contracts"])

    blocks_baked = tezos.blocks_baked_between(baker, start_cycle, current_cycle)
    blocks_stolen = tezos.blocks_stolen_between(baker, start_cycle, current_cycle)
    blocks_missed = tezos.blocks_missed_between(baker, start_cycle, current_cycle)

    num_blocks_baked = len(blocks_baked)
    num_blocks_stolen = len(blocks_stolen)
    num_blocks_missed = len(blocks_missed)

    fees_in_baked = tezos.sum_fees_for_blocks(blocks_baked)
    fees_in_stolen = tezos.sum_fees_for_blocks(blocks_stolen)
    fees_in_missed = tezos.sum_fees_for_blocks(blocks_missed)

    num_endorsements_in_baked = tezos.sum_endorsements_in_blocks(blocks_baked)
    num_endorsements_in_stolen = tezos.sum_endorsements_in_blocks(blocks_stolen)
    num_endorsements_in_missed = tezos.sum_endorsements_in_blocks(blocks_missed)

    high_priority_endorsements = tezos.endorsements_made_between(baker,
                                                                 start_cycle,
                                                                 current_cycle,
                                                                 "high")
    low_priority_endorsements = tezos.endorsements_made_between(baker,
                                                                start_cycle,
                                                                current_cycle,
                                                                "low")
    missed_endorsements = tezos.endorsements_missed_between(baker, start_cycle,
                                                            current_cycle)

    num_revelations_in_baked = tezos.sum_revelations_in(blocks_baked)
    num_revelations_in_stolen = tezos.sum_revelations_in(blocks_stolen)
    num_revelations_in_missed = tezos.sum_revelations_in(blocks_missed)

    nonces_not_revealed = tezos.nonces_not_revealed_between(baker, start_cycle,
                                                            current_cycle )
    num_nonces_not_revealed = len(nonces_not_revealed)
    endorsements_in_not_revealed = tezos. \
        sum_endorsements_in_blocks(nonces_not_revealed)
    fees_in_not_revealed = tezos.sum_fees_for_blocks(nonces_not_revealed)

    blocks_per_stake = 0 if staking_balance==0 else \
        float(num_blocks_baked/staking_balance)

    # TODO: remove grade calculation from server side and move into frontend js
    # A baker grade is calculated from the data collected. See readme for a
    # description on the formula used

    grade = (100000 * blocks_per_stake) * \
        (num_blocks_baked + num_blocks_stolen) / (1 + num_blocks_baked) * \
        (math.exp(-1 * (num_blocks_missed / (num_blocks_baked + 1)))) * \
        (1 - (1 / (1 + num_delegators)))

    # alternate formula (not tested):
    # grade =  (100000 * num_blocks_per_stake) * (num_blocks_baked+5*s)/ \
    #    (1+num_blocks_missed+num_blocks_baked) \
    #     *(1-(1/(1+d)))

    row = BakerPerformance(baker=baker, cycle=current_cycle,
                           num_baked=num_blocks_baked,
                           num_stolen=num_blocks_stolen,
                           num_missed=num_blocks_missed,
                           fees_in_baked=fees_in_baked,
                           fees_in_stolen=fees_in_stolen,
                           fees_in_missed=fees_in_missed,
                           num_endorsements_in_baked=num_endorsements_in_baked,
                           num_endorsements_in_stolen=num_endorsements_in_stolen,
                           num_endorsements_in_missed=num_endorsements_in_missed,
                           high_priority_endorsements=high_priority_endorsements,
                           low_priority_endorsements=low_priority_endorsements,
                           missed_endorsements=missed_endorsements,
                           num_revelations_in_baked=num_revelations_in_baked,
                           num_revelations_in_stolen=num_revelations_in_stolen,
                           num_revelations_in_missed=num_revelations_in_missed,
                           num_nonces_not_revealed=num_nonces_not_revealed,
                           endorsements_in_not_revealed=endorsements_in_not_revealed,
                           fees_in_not_revealed=fees_in_not_revealed,
                           grade=grade)
    return row


@service_utils.populate_from_cycle(BakerPerformance)
def populate_baker_performance(cycle, after=populate_grades):
    """Populates general columns of the baker_performance table, followed by the
    grades, in each cycle"""

    print("Acquiring baker performance data for cycle %s..." % cycle)
    start_cycle = cycle - SAMPLE_RANGE
    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:
        data.append(get_baker_performance(baker, cycle))
    return data
