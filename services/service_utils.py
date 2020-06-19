import postgres, json, queries as tezos
import time, sys

def populate_from_cycle(table, columns):
    if len(sys.argv) != 2:
        print("Please specify a cycle to start sync from")
        return lambda _ : _
    
    def inner(func):
        cycle = int(sys.argv[1])
        while (True):
            latest_cycle = tezos.current_cycle()
            print("Checking cycle")
            if cycle >= latest_cycle:
                level = tezos.current_level()
                end_of_cycle_level = tezos.cycle_to_level(latest_cycle+1)
                time_to_sleep = (end_of_cycle_level - level) * 40
                print("Up to date. %s blocks until next cycle" % (end_of_cycle_level - level))
                print("Sleeping for %s seconds." % time_to_sleep)
                time.sleep(time_to_sleep)
            else:
                postgres.push(postgres.getLogin(), table, columns, func(cycle))
                print("Done")
                cycle += 1

    return inner
