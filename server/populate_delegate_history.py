import postgres, service_utils, queries as tezos

TABLE = "baking_info.delegate_history"
COLUMNS =  ("cycle", "snapshot_block_level", "delegator", "baker")


@service_utils.populate_from_cycle(TABLE, COLUMNS)
def delegate_history(cycle):
    print("Acquiring delegate history for cycle %s..." % cycle)
    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:
        snapshot_index = tezos.snapshot_index(cycle)
        snapshot_block = (cycle - tezos.PRESERVED_CYCLES - 2) * tezos.CYCLE_SIZE + (snapshot_index + 1) * tezos.SNAPSHOT_BLOCKS;
        snapshot_level = snapshot_block - 1
        response = tezos.baker_info_at_level(baker, snapshot_level)
        if not "delegated_contracts" in response:
            continue
        for delegator in response["delegated_contracts"]:
            data.append((cycle, snapshot_block, delegator, baker))
    return data
