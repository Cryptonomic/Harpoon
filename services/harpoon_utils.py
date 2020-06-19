
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
