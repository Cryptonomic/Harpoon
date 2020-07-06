import time, sys, requests
from microseil import get_session
import queries as tezos
    
def populate_from_cycle():
    """Decorator which automates populating database tables
    
    populate_from_cycle() wraps around a function which calculates all the values
    for a given table for a single cycle. The decorator then calls this function 
    sequentially for each cycle, starting from the the specified start cyce, and 
    populates the corresponding table. This is done until the cycle to be populated
    is equal to the current cycle, after which the process sleeps for the minumum
    amount of time until the next cycle is expected to start. 
    """

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
                time_to_sleep = (end_of_cycle_level - level + 1) * 40
                print("Up to date. %s blocks until next cycle" % (end_of_cycle_level - level))
                print("Sleeping for %s seconds." % time_to_sleep)
                time.sleep(time_to_sleep)
            else:
                try:
                    session = get_session()
                    session.add_all(func(cycle))
                    session.commit()
                    print("Done")
                    cycle += 1
                except requests.exceptions.ReadTimeout:
                    print("Request timeout on cycle %s. Retrying..." % cycle)
                    
    return inner
