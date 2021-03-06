import service_utils
import queries as tezos
from microseil import SnapshotInfo


@service_utils.populate_from_cycle(SnapshotInfo)
def get_snapshot_data(cycle):
    """Populates snapshot_info table with data for each baker at given cycle"""

    print("Acquiring snapshot data for cycle %s..." % cycle)
    snapshot_index = tezos.snapshot_index(cycle)

    # snapshot_block is the actual block level of the snapshot. However,
    # snapshot data such as roll balances are taken before operations in the
    # snapshot block have settled. The correct balances are those after the
    # block before the snapshot block has been baked (snapshot_level)

    snapshot_block = tezos.snapshot_index_to_block(snapshot_index, cycle)
    snapshot_level = snapshot_block - 1
    end_of_cycle = tezos.cycle_to_level(cycle + 1) + 1

    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:
        response = tezos.baker_info_at_level(baker, snapshot_level)

        # if the rpc comes back with an unexpected response
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
                                 rewards=reward))

    return data
