import time
import sys
import requests
import json
import traceback
from microseil import get_session, func
from sqlalchemy.sql import case
import queries as tezos


def update_for_key_in_cycle(table, key, to_update):
    """Decorator which allows a function to selectively update columns in a
    table

    update_for_key_in_cycles wraps around any function which takes a cycle as a
    parameter and returns a dictionary where the keys are the same type as db
    column passed in as the key parameter and the values of the dictionary are
    the same type as the db column passed in as to_update. In other words, the
    function being wrapped must have a signature of:

        (cycle: int) => {key.type: to_update.type}

    The decorator returns a new function that takes a cycle as a parameter. The
    decorator will take care of matching each key to a db row and updating the
    column to_update with the value of the corresponding dictionary entry. This
    is optimized to be done in a single update
    """
    
    def inner(f):        
        def wrapped(cycle): 
            print("Updating %ss for each %s in cycle %s for %s table..." %(
                to_update.name, key.name, cycle, table.__tablename__))            
            data = f(cycle)
            session = get_session()
            query = session.query
            query(table).filter(
                key.in_(data),
                table.cycle == cycle
            ).update({
                to_update: case(data, value=key)
            }, synchronize_session=False)
            
            session.commit()
            session.close()
            print("Done updating %ss in %s for cycle %s" % 
                (to_update.name, table.__tablename__, cycle))
        return wrapped
    return inner


# TODO: error handling for "after"
def populate_from_cycle(table, after=None):
    """Decorator which automates populating database tables

    populate_from_cycle wraps around a function which calculates all the
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
                        if (after != None):
                            after(cycle)
                    else:
                        print("No data for cycle %s. Skipping..." % cycle)
                    cycle += 1
                except requests.exceptions.ReadTimeout:
                    traceback.print_exc()
                    print("Request timeout on cycle %s. Retrying..." % cycle)
                except json.decoder.JSONDecodeError:
                    traceback.print_exc()
                    print("Unexpected data received on cycle %s. Retrying..." % cycle)
                except Exception as e:
                    print("Encountered error on cycle %s:" % cycle)
                    traceback.print_exc()
                    print("Retrying...")
    return inner
