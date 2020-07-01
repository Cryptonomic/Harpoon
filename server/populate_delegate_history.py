import service_utils, queries as tezos
from microseil import DelegateHistory

@service_utils.populate_from_cycle()
def delegate_history(cycle):
    print("Acquiring delegate history for cycle %s..." % cycle)
    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:
        snapshot_index = tezos.snapshot_index(cycle)
        snapshot_block = (cycle - tezos.PRESERVED_CYCLES - 2) * \
            tezos.CYCLE_SIZE + (snapshot_index + 1) * tezos.SNAPSHOT_BLOCKS;
        snapshot_level = snapshot_block - 1
        response = tezos.baker_info_at_level(baker, snapshot_level)
        if not "delegated_contracts" in response:
            continue
        for delegator in response["delegated_contracts"]:
            data.append(DelegateHistory(cycle=cycle,
                                        snapshot_block_level=snapshot_block,
                                        delegator=delegator,
                                        baker=baker))
    return data
