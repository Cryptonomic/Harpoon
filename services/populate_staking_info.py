import postgres
import math, time, requests, json
from conseil.api import ConseilApi
from conseil.core import ConseilClient as Client

conseil = Client(ConseilApi(
    api_key='galleon',
    api_host='https://conseil-prod.cryptonomic-infra.tech:443',
    api_version=2
))

blocks = conseil.tezos.mainnet.blocks
delegates = conseil.tezos.mainnet.delegates

PRESERVED_CYCLES = 5
CYCLE_SIZE = 4096
SNAPSHOT_BLOCKS = 256
base = "http://157.245.219.171:8732/"


def getSnapshotData(cycle, bakers):
    cycleLevel = cycle * 4096 + 1;
    r = requests.get("%s/chains/main/blocks/%d/context/raw/json/cycle/%d/roll_snapshot" % (base, cycleLevel, cycle)) 
    snapshotIndex = int(r.text)
    snapshotBlock = (cycle - PRESERVED_CYCLES - 2) * CYCLE_SIZE + (snapshotIndex + 1) * SNAPSHOT_BLOCKS;
    snapshotLevel = snapshotBlock - 1
    endOfCycle = (cycle + 1) * CYCLE_SIZE + 1

    data = []
    for baker in bakers:
        response = requests.get("%s/chains/main/blocks/%s/context/delegates/%s" % (base, snapshotLevel, baker));
        response = response.text

        #if the rpc comes back with an unexpected response
        if response[0] == "[":
            continue

        info = json.loads(response)
        delegated_balance = int(info["delegated_balance"])
        staking_balance = int(info["staking_balance"])

        response = requests.get("%s/chains/main/blocks/%s/context/delegates/%s" % (base, endOfCycle, baker));
        response = json.loads(response.text)
        rewards = response["frozen_balance_by_cycle"]
        reward = 0
        for entry in rewards:
            if entry["cycle"] == cycle:
                reward = int(entry["fees"]) + int(entry["rewards"])

        data.append((cycle, snapshotIndex, snapshotBlock, baker,
                     staking_balance, delegated_balance, reward));

    return data


def populate(starting_cycle):
    db = postgres.getLogin()
    cycle = starting_cycle
    currentBlockCycle = blocks.query(blocks.meta_cycle) \
                              .order_by(blocks.level.desc())\
                              .limit(1).scalar()

    while (True):
        print("Checking cycle")
        if cycle > currentBlockCycle:
            print("Up to date")
            time.sleep(60)
        else:
            print("Calculating...")
            bakers = delegates.query(delegates.pkh).order_by(delegates.staking_balance.desc()) \
                                                   .filter(delegates.deactivated==False) \
                                                   .limit(1000).vector()
            postgres.push(db, "baking_info.snapshot_info", ("cycle", "snapshot_index", "snapshot_block_level",
                                                       "baker", "staking_balance", "delegated_balance",
                                                       "rewards"), getSnapshotData(cycle, bakers))
            print("Done calculating for cycle " + str(cycle))
            cycle += 1


populate(243);
