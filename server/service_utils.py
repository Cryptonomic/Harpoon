import time
import sys
import requests
from microseil import get_session, func
import queries as tezos


def populate_from_cycle(table):
    """Decorator which automates populating database tables

    populate_from_cycle() wraps around a function which calculates all the
    values for a given table for a single cycle. The decorator then calls this
    function sequentially for each cycle, starting from the the specified start
    cycle, and populates the corresponding table. This is done until the cycle
    to be populated is equal to the current cycle, after which the process
    sleeps for the minumum amount of time until the next cycle is expected to
    start.
    """

    if len(sys.argv) != 2:
        print("Please specify a cycle to start sync from")
        return lambda _: _

    def inner(f):
        cycle = int(sys.argv[1])
        session = get_session()
        latest_cycle = session.query(func.max(table.cycle)).scalar()
        session.close()
        
        if latest_cycle and int(latest_cycle) > cycle:
            latest_cycle = int(latest_cycle)
            cycle = latest_cycle + 1
            print("%s has data from %s. Skipping to cycle %s..." % 
                (table.__tablename__, latest_cycle, cycle))
        
        while True:
            latest_cycle = tezos.current_cycle()
            print("Checking cycle")
            if cycle >= latest_cycle:
                level = tezos.current_level()
                end_of_cycle_level = tezos.cycle_to_level(latest_cycle+1)
                minimum_block_delay = 60
                time_to_sleep = (end_of_cycle_level - level + 1) * \
                    minimum_block_delay
                print("Up to date. %s blocks until next cycle" %
                      (end_of_cycle_level - level))
                print("Sleeping for %s seconds." % time_to_sleep)
                time.sleep(time_to_sleep)
            else:
                try:
                    data = f(cycle)
                    if len(data) != 0:
                        session = get_session()
                        session.add_all(data)
                        session.commit()
                        session.close()
                        print("Done")
                    else:
                        print("No data for cycle %s. Skipping..." % cycle)
                    cycle += 1
                except requests.exceptions.ReadTimeout:
                    print("Request timeout on cycle %s. Retrying..." % cycle)

    return inner
