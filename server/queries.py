import requests
import json
import math
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
accounts = conseil.tezos.mainnet.accounts
bakers = conseil.tezos.mainnet.bakers
baking_rights = conseil.tezos.mainnet.baking_rights
endorsing_rights = conseil.tezos.mainnet.endorsing_rights

# Tezos node to hit for rpc queries
BASE_URL = TEZOS_CONF["host"] + ":" + str(TEZOS_CONF["port"]) + "/"

# TODO: refactor to allow for testnet support based off of user configuration
# Current size of cycle
CYCLE_SIZE = 4096

# Tezos constants
PRESERVED_CYCLES = 5
PENDING_CYCLES = 2
SNAPSHOT_BLOCKS = 256

# Arbitrary large value for conseilpy queries
MAX_LIMIT = 100000000


def partition_query(partition_size=50):
    """Decorator function for conseil queries which use the IN clause

    In order to prevent timeouts for conseilpy queries which need to search
    through an array of values, partition_query() takes the array to search and
    splits it based on partition_size to make several more manageable arrays.
    The query is then executed over the several partitions and then added
    together

    Args:
        partition_size: Size which each array in the IN clause of the wrapped
        function will be
    """

    def inner(f):
        def sum_partitions(block_levels, *args):
            num_cycles = math.floor(len(block_levels)/partition_size)

            # Get default empty value for function
            total = f([], *args)
            for i in range(num_cycles):
                total += f(block_levels[i * partition_size: (i+1) *
                                        partition_size],
                           *args)
            if (partition_size * num_cycles) < len(block_levels):
                total += f(block_levels[partition_size * num_cycles:], *args)
            return total
        return sum_partitions
    return inner


def utez_to_tez(num):
    return num / 1000000


def cycle_to_level(cycle):
    return cycle * CYCLE_SIZE


def current_cycle():
    return int(blocks.query(blocks.meta_cycle)
               .order_by(blocks.level.desc())
               .limit(1)
               .scalar())


def current_level():
    return int(blocks.query(blocks.level)
               .order_by(blocks.level.desc())
               .limit(1)
               .scalar())


def assigned_blocks_between(baker, start_cycle, end_cycle):
    rights = baking_rights.query(baking_rights.level) \
                          .filter(baking_rights.delegate == baker,
                                  baking_rights.priority == 0,
                                  baking_rights.cycle.between(start_cycle,
                                                              end_cycle)) \
                          .order_by(baking_rights.level.asc()) \
                          .limit(MAX_LIMIT) \
                          .vector()
    return rights


def blocks_baked_between(baker, start_cycle, end_cycle):
    """Returns levels of all blocks baked with priority zero by baker"""

    return blocks.query(blocks.level) \
                 .filter(blocks.baker == baker,
                         blocks.meta_cycle.between(start_cycle, end_cycle),
                         blocks.priority == 0)\
                 .vector()


def blocks_stolen_between(baker, start_cycle, end_cycle):
    """Returns levels of all blocks baked with priority one or higher by
    baker"""

    return blocks.query(blocks.level) \
                 .filter(blocks.baker == baker,
                         blocks.priority > 0,
                         blocks.meta_cycle.between(start_cycle, end_cycle))\
                 .vector()


def blocks_missed_between(baker, start_cycle, end_cycle):
    """Returns levels of blocks that were assigned to but not successfully
    baked by baker"""

    rights = assigned_blocks_between(baker, start_cycle, end_cycle)
    return blocks.query(blocks.level) \
                 .filter(blocks.level.in_(*rights),
                         blocks.baker != baker) \
                 .limit(MAX_LIMIT) \
                 .vector()


def blocks_with_priority_between(start_cycle, end_cycle, priority="high"):
    """Returns a list of levels of blocks that were baked with a priority 0
    (high) or a priority greater than 1 (low)"""

    priority_filter = blocks.priority.__gt__(0) if priority == "low" else \
        blocks.priority.__eq__(0)

    return blocks.query(blocks.level) \
                 .filter(blocks.meta_cycle.between(start_cycle, end_cycle),
                         priority_filter) \
                 .limit(MAX_LIMIT) \
                 .vector()


def endorsements_made_in_levels_between(baker, start_cycle, end_cycle):
    """Returns a list of all the levels where the baker endorsed"""

    return operations.query(operations.level) \
                     .filter(operations.kind == "endorsement",
                             operations.cycle.between(start_cycle, end_cycle),
                             operations.delegate == baker) \
                     .vector()


def endorsements_made_in_levels_with_priority(baker, start_cycle, end_cycle,
                                              priority="high"):
    """Returns a list of levels which baker has endorsed where the block was
    priority 0 (high) or a priority greater than 1 (low)"""

    block_levels = blocks_with_priority_between(start_cycle, end_cycle, priority)
    endorsements = endorsements_made_in_levels_between(baker, start_cycle,
                                                       end_cycle)
    return [level for level in endorsements if level+1 in block_levels]


def endorsements_missed_between(baker, start_cycle, end_cycle):
    start_level = cycle_to_level(start_cycle)
    end_level = cycle_to_level(end_cycle+1) - 1
    rights = endorsing_rights \
        .query(endorsing_rights.level,
               endorsing_rights.level.count()) \
        .filter(endorsing_rights.delegate == baker,
                endorsing_rights.level.between(start_level, end_level)) \
        .scalar()

    if rights is None:
        return 0
    endorsements = operations.query(operations.number_of_slots,
                                    operations.number_of_slots.sum()) \
                             .filter(operations.kind == "endorsement",
                                     operations.delegate == baker,
                                     operations.cycle.between(start_cycle,
                                                              end_cycle)) \
                             .scalar()
    if endorsements is None:
        return int(rights)
    return int(rights) - int(endorsements)


@partition_query(5000)
def sum_endorsements_made_in(block_levels, baker):
    """Returns the number of endorsements made by baker in block_levels"""

    if len(block_levels) == 0:
        return 0

    return int(operations.query(operations.number_of_slots,
                                operations.number_of_slots.sum())
               .filter(operations.delegate == baker,
                       operations.level.in_(*block_levels))
               .scalar())


@partition_query()
def sum_endorsements_in_blocks(block_levels):
    """Returns the sum endorsing power in block_levels"""

    if len(block_levels) == 0:
        return 0

    return int(operations.query(operations.number_of_slots,
                                operations.number_of_slots.sum())
               .filter(operations.block_level.in_(*block_levels))
               .scalar())


@partition_query()
def sum_fees_for_blocks(block_levels):
    if len(block_levels) == 0:
        return 0
    fees = operations.query(operations.fee,
                            operations.fee.sum()) \
                     .filter(operations.block_level.in_(*block_levels)) \
                     .scalar()
    if fees is None:
        return 0
    return int(fees)


@partition_query(1000)
def sum_revelations_in(block_levels):
    if len(block_levels) == 0:
        return 0
    
    return int(operations.query(operations.operation_group_hash,
                                operations.operation_group_hash.count()) 
               .filter(operations.block_level.in_(*block_levels),
                       operations.kind == "seed_nonce_revelation")
               .scalar())


@partition_query()
def nonces_not_revealed_in(commitments):
    if len(commitments) == 0:
        return []

    revelations = operations.query(operations.level) \
                            .filter(operations.level.in_(*commitments),
                                    operations.kind == "seed_nonce_revelation") \
                            .vector()

    return [level for level in commitments if level not in revelations]


def nonces_not_revealed_between(baker, start_cycle, end_cycle):
    return nonces_not_revealed_in(
        commitments_made_between(baker, start_cycle, end_cycle))


def endorsements_made_between(baker, start_cycle, end_cycle, priority="high"):
    """Returns the number of endorsement slots baker has endorsed where the
    block was priority 0 (high) or a priority greater than 1 (low)"""

    return sum_endorsements_made_in(
        endorsements_made_in_levels_with_priority(baker, start_cycle,
                                                  end_cycle, priority), baker)


def commitments_made_between(baker, start_cycle, end_cycle):
    """Returns a list of levels where a seed nonce commitement was made"""

    return blocks.query(blocks.level) \
                 .filter(blocks.baker == baker,
                         blocks.meta_cycle.between(start_cycle, end_cycle),
                         blocks.expected_commitment == "true",
                         blocks.nonce_hash.isnot(None)) \
                 .vector()


def all_bakers():
    return bakers.query(bakers.pkh).order_by(bakers.staking_balance.desc()) \
                                   .filter(bakers.deactivated == False) \
                                   .limit(1000).vector()


def active_bakers_between(start_cycle, end_cycle):
    """Returns all bakers who've baked a block in [start_cycle, end_cycle]"""

    baker_list = all_bakers()
    active = list(set(blocks.query(blocks.baker)
                      .filter(blocks.meta_cycle.between(start_cycle,
                                                        end_cycle))
                      .vector()))
    return [baker for baker in baker_list if baker in active]


def transaction_sources_in_cycle(destination, cycle):
    return operations.query(operations.source) \
                     .filter(operations.destination == destination,
                             operations.cycle == cycle) \
                     .vector()


def baker_info_at_level(baker, level):
    """Returns a dictionary containing relevant baker stats at a given level

    The dictionary which is returned containes balance stats such as staking,
    delegated and frozen balance. Frozen balance is further subdivided into
    rewards, security deposits, and fees. The rpc also has delegated contracts
    active at the given level
    """
    response = requests.get(("%s/chains/main/blocks/" +
                             "%s/context/delegates/%s") %
                            (BASE_URL, level, baker))
    return (json.loads(response.text))


def operations_in(block_level):
    """Returns a dictionary containing the operation data in the block at
    block level. 
    
    The rpc endpoint is used instead of conseil because double 
    baking/endorsing data is not available at the time of this writing.
    """

    r = requests.get(("%s/chains/main/blocks/%d/operations" %
                     (BASE_URL, block_level)))
    
    return json.loads(r.text)

            
def accusations_between(start_cycle, end_cycle, accusation_type):
    """Returns a list of levels where accusations were made
    
    Args:
        start_cycle (int): Lower bound of range to search in
        end_cycle (int): Upper bound of range to search in
        accusation_type (string): The type of accusation to search for. 
            "baking" for double baking accusations and "endorsement" for 
            double endorsement accusations
    """
    type_to_field = {"baking":"double_baking_evidence",
                     "endorsement":"double_endorsement_evidence"}

    accusations = operations.query(operations.block_level) \
                            .filter(operations.cycle.between(start_cycle, end_cycle),
                                    operations.kind == type_to_field[accusation_type]) \
                            .vector()

    return accusations
    

def evidence_in(operations, evidence_type):
    """Parses a dictionary containing chain operations and extracts double
    baking/endorsing evidence

    Args:
        operations (dict): Python dictionary representing the tezos operations
        evidence_type (string): A string indicating the type of evidence to
            parse for. "baking" for double baking and "endorsement" for double
            endorsement
    """

    type_to_field = {"baking":"double_baking_evidence",
                     "endorsement":"double_endorsement_evidence"}
    
    evidence = []
    for operation_group in operations:
        for operation in operation_group:
            for content in operation["contents"]:
                if content["kind"] == type_to_field[evidence_type]:
                    evidence.append(content)
    return evidence

    
def snapshot_index(cycle):
    """Returns the level of the snapshot for a given cycle"""

    cycleLevel = cycle_to_level(cycle) + 1
    r = requests.get(("%s/chains/main/blocks/%d/context/" +
                      "raw/json/cycle/%d/roll_snapshot") %
                     (BASE_URL, cycleLevel, cycle))
    return int(r.text)


def snapshot_index_to_block(index, cycle):
    """Returns the level of the block from the snapshot_index and cycle

    Every cycle in Tezos is associated with a random value from 0-15 called a
    snapshot index. The snapshot index determines which one of the 16 evenly
    spaced snapshots from cycle x - PRESERVED_CYCLES - PENDING_CYCLES was used
    for baking rights in the current cycle. A snapshot is taken once every
    SNAPSHOT_BLOCKS blocks. The level of the snapshot block level is calculated
    by the formula this function wraps.

    Args:
        index: (int) Snapshot index of the cycle
        cycle: (int) cycle of the snapshot index being used
    """

    # The first line resolves to the first block of the cycle which the
    # snapshot index refers to. The second line adds the correct number of
    # levels to this value in order to arrive at the correct level of the
    # snapshot block. See README for more information

    return (cycle - PRESERVED_CYCLES - PENDING_CYCLES) * CYCLE_SIZE + \
        (index + 1) * SNAPSHOT_BLOCKS
