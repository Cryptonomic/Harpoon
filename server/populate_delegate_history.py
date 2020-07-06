import service_utils, queries as tezos
from microseil import DelegateHistory

@service_utils.populate_from_cycle()
def delegate_history(cycle):
    """Populates delegate_history table with data for each baker at a given cycle"""

    print("Acquiring delegate history for cycle %s..." % cycle)
    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:

        # See README.md for a description on these values
        snapshot_index = tezos.snapshot_index(cycle)
        snapshot_block = tezos.snapshot_index_to_block(snapshot_index, cycle):
        snapshot_level = snapshot_block - 1

        #if the rpc comes back with an unexpected response
        response = tezos.baker_info_at_level(baker, snapshot_level)
        if not "delegated_contracts" in response:
            continue
        for delegator in response["delegated_contracts"]:
            data.append(DelegateHistory(cycle=cycle,
                                        snapshot_block_level=snapshot_block,
                                        delegator=delegator,
                                        baker=baker))
    return data
