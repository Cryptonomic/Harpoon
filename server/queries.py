import requests, json, math
from microseil import get_user_config
from conseil.api import ConseilApi
from conseil.core import ConseilClient as Client

NET_CONF = get_user_config()
CONSEIL_CONF = NET_CONF["conseil"]
TEZOS_CONF = NET_CONF["tezos"]

conseil = Client(ConseilApi(
    api_key=CONSEIL_CONF["api_key"],
    api_host=CONSEIL_CONF["host"],
    api_version=CONSEIL_CONF["version"]
))

blocks = conseil.tezos.mainnet.blocks
operations = conseil.tezos.mainnet.operations
accounts= conseil.tezos.mainnet.accounts
bakers = conseil.tezos.mainnet.bakers
baking_rights = conseil.tezos.mainnet.baking_rights

# Tezos node to hit for rpc queries
BASE_URL = TEZOS_CONF["host"] + ":" + str(TEZOS_CONF["port"]) + "/"

# TODO: refactor to allow for testnet support based off of user configuration
# Current size of cycle
CYCLE_SIZE = 4096

# Tezos constants
PRESERVED_CYCLES = 5
PENDING_CYCLES = 5
SNAPSHOT_BLOCKS = 256

# Arbitrary large value for conseilpy queries
MAX_LIMIT = 100000000

def partition_query(f):
    """Decorator function for conseil queries which use the IN clause

    In order to prevent timeouts for conseilpy queries which need to search through
    an array of values, partition_query() takes the array to search and splits it based
    on partition_size to make several more manageable arrays. The query is then executed
    over the several partitions and then added together
    """

    partition_size = 50
    def sum_partitions(blocks):
        num_cycles = math.floor(len(blocks)/partition_size)
        total = 0
        for i in range(num_cycles):
            total += f(blocks[i * partition_size: (i+1) * partition_size])
        if (partition_size * num_cycles) < len(blocks):
            total += f(blocks[partition_size * num_cycles:])
        return total
    return sum_partitions

def utez_to_tez(num):
    return num / 1000000

def cycle_to_level(cycle):
    return cycle * CYCLE_SIZE

def current_cycle():
    return int(blocks.query(blocks.meta_cycle) \
               .order_by(blocks.level.desc()) \
               .limit(1) \
               .scalar())

def current_level():
    return int(blocks.query(blocks.level) \
               .order_by(blocks.level.desc()) \
               .limit(1) \
               .scalar())

def assigned_blocks_between(baker, start_cycle, end_cycle):
    rights = baking_rights.query(baking_rights.level) \
                          .filter(baking_rights.delegate==baker,
                                  baking_rights.priority==0,
                                  baking_rights.cycle.between(start_cycle, end_cycle)) \
                          .order_by(baking_rights.level.asc()) \
                          .limit(MAX_LIMIT) \
                          .vector()
    return rights

def blocks_baked_between(baker, start_cycle, end_cycle):
    return blocks.query(blocks.level) \
                 .filter(blocks.baker==baker,
                         blocks.meta_cycle.between(start_cycle, end_cycle),
                         blocks.priority==0)\
                 .all()

def blocks_stolen_between(baker, start_cycle, end_cycle):
    return blocks.query(blocks.level) \
                 .filter(blocks.baker==baker,
                         blocks.priority>0, \
                         blocks.meta_cycle.between(start_cycle, end_cycle))\
                 .all()

def blocks_missed_between(baker, start_cycle, end_cycle):
    rights = assigned_blocks_between(baker, start_cycle, end_cycle)
    return blocks.query(blocks.level) \
                 .filter(blocks.level.in_(*rights),
                         blocks.baker!=baker) \
                 .limit(MAX_LIMIT) \
                 .all()

@partition_query
def sum_endorsements_for_blocks(blocks):
    if len(blocks) == 0: return 0
    op_levels = [entry["level"] + 1 for entry in blocks]
    return int(operations.query(operations.number_of_slots,
                                operations.number_of_slots.sum()) \
               .filter(operations.level.in_(*op_levels)) \
               .scalar())

def all_bakers():
    return  bakers.query(bakers.pkh).order_by(bakers.staking_balance.desc()) \
                                          .filter(bakers.deactivated==False) \
                                          .limit(1000).vector()

def active_bakers_between(start_cycle, end_cycle):
    """Returns all bakers who've baked a block betwen start_cycle and end_cycle"""

    bakers = all_bakers()
    active = list(set(blocks.query(blocks.baker) \
                      .filter(blocks.meta_cycle.between(start_cycle, end_cycle)) \
                      .vector()))
    return [baker for baker in bakers if baker in active]

def transaction_sources_in_cycle(destination, cycle):
    return operations.query(operations.source) \
                     .filter(operations.destination==destination,
                             operations.cycle==cycle) \
                     .all()

def baker_info_at_level(baker, level):
    """Returns a dictionary containing relevant baker stats at a given level
    
    The dictionary which is returned containes balance stats such as staking, delegated 
    and frozen balance. Frozen balance is further subdivided into rewards, security 
    deposits, and fees. The rpc also has delegated contracts active at the given level
    """
    response = requests.get("%s/chains/main/blocks/%s/context/delegates/%s" % (BASE_URL, level, baker))
    return (json.loads(response.text))

def snapshot_index(cycle):
    cycleLevel = cycle_to_level(cycle) + 1
    r = requests.get("%s/chains/main/blocks/%d/context/raw/json/cycle/%d/roll_snapshot" % (BASE_URL, cycleLevel, cycle)) 
    return int(r.text)

def snapshot_index_to_block(index, cycle):
    """Returns the level of the block from the snapshot_index and cycle
    
    Every cycle in Tezos is associated with a random value from 0-15 called a snapshot
    index. The snapshot index determines which one of the 16 evenly spaced snapshots
    from cycle x - PRESERVED_CYCLES - PENDING_CYCLES was used for baking rights in the
    current cycle. A snapshot is taken once every SNAPSHOT_BLOCKS blocks. 

    Args:
        index: (int) Snapshot index of the cycle
        cycle: (int) cycle of the snapshot index being used
    """

    # The first line resolves to the first block of  cycle which the snapshot index
    # refers to. The second line adds the correct number of levels to this value in
    # order to arrive at the correct level of the snapshot block

    return (cycle - PRESERVED_CYCLES - PENDING_CYCLES) * CYCLE_SIZE + \
        (index + 1) * SNAPSHOT_BLOCKS;

