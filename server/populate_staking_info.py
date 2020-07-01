import service_utils, queries as tezos
from microseil import SnapshotInfo

@service_utils.populate_from_cycle()
def get_snapshot_data(cycle):
    print("Calculating snapshot data for cycle %s..." % cycle)
    snapshot_index = tezos.snapshot_index(cycle)
    snapshot_block = (cycle - tezos.PRESERVED_CYCLES - 2) * tezos.CYCLE_SIZE + (snapshot_index + 1) * tezos.SNAPSHOT_BLOCKS;
    snapshot_level = snapshot_block - 1
    end_of_cycle = tezos.cycle_to_level(cycle + 1) + 1

    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:
        response = tezos.baker_info_at_level(baker, snapshot_level)

        #if the rpc comes back with an unexpected response
        if not ("delegated_contracts" in response):
            continue

        delegated_balance = int(response["delegated_balance"])
        staking_balance = int(response["staking_balance"])

        response = tezos.baker_info_at_level(baker, end_of_cycle)

        rewards = response["frozen_balance_by_cycle"]
        reward = 0
        for entry in rewards:
            if entry["cycle"] == cycle:
                reward = int(entry["fees"]) + int(entry["rewards"])

        data.append(SnapshotInfo(cycle=cycle, baker=baker,
                                 snapshot_index=snapshot_index,
                                 snapshot_block_level=snapshot_block,
                                 staking_balance=staking_balance,
                                 delegated_balance=delegated_balance,
                                 rewards=reward));

    return data






