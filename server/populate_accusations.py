import service_utils
import queries as tezos
from microseil import Accusations

# Size of the range in cycles to use in pulling performance data.
SAMPLE_RANGE = 0


def accusation_balance_updates_between(start_cycle, end_cycle,
                                       accusation_type):
    """Returns a python dictionary with the balance updates from accusations
    in the range [start_cycle, end_cycle]. 

    Args:
        start_cycle (int): Start of the range to search in
        end_cycle (int): End of the range to search in
        accusation_type (string): A string describing the kind of accustaions
            to look in. "baking" for double baking accusations and
            "endorsement" for double endorsement accusations
    """

    accusations = tezos.accusations_between(start_cycle, end_cycle,
                                            accusation_type)
    balance_updates = []
    evidence = []

    for block_level in accusations:
        evidence.extend(
            tezos.evidence_in(
                tezos.operations_in(block_level), accusation_type))

    for entry in evidence:
        for update in entry["metadata"]["balance_updates"]:
            balance_updates.append(update)
            
    return balance_updates


def parse_balance_updates(balance_updates):
    """Returns a python dictionary where each key is an address and each value
    is a dictionary containing balance updates categorized by type

    Args:
        balance_updates (dict): a dictionary containing balance update data
        a block
    """

    address_to_update = {}

    for update in balance_updates:
        delegate = update["delegate"]
        if delegate not in address_to_update:
            address_to_update[delegate] = {"accusation_rewards":0,
                                           "lost_fees":0,
                                           "lost_deposits":0,
                                           "lost_rewards":0}
        entry = address_to_update[delegate]
        change = int(update["change"])

        if update["category"] == "deposits":
            entry["lost_deposits"] += -1 * change
        elif update["category"] == "fees":
            entry["lost_fees"] += -1 * change
        elif update["category"] == "rewards":
            if change > 0:
                entry["accusation_rewards"] += change
            else:
                entry["lost_rewards"] += -1 * change

    return address_to_update


def empty_row():
    """A helper function creating a default dictionary"""

    return {"double_baking_accusation_rewards": 0,
            "double_baking_lost_rewards":0,
            "double_baking_lost_fees":0,
            "double_baking_lost_deposits":0,
            "double_endorsement_accusation_rewards":0,
            "double_endorsement_lost_rewards":0,
            "double_endorsement_lost_fees":0,
            "double_endorsement_lost_deposits":0}


@service_utils.populate_from_cycle(Accusations)
def populate_accusations(cycle):
    """Populates accusations table with data for each baker at a given
    cycle"""

    print("Acquiring accusation data for cycle %s..." % cycle)
    start_cycle = cycle - SAMPLE_RANGE
    data = {}

    double_baking_data = parse_balance_updates(
        accusation_balance_updates_between(start_cycle, cycle, "baking"))

    double_endorsement_data = parse_balance_updates(
        accusation_balance_updates_between(start_cycle, cycle, "endorsement"))

    for delegate in double_baking_data:
        row = empty_row()
        entry = double_baking_data[delegate]
        row["double_baking_accusation_rewards"] = \
            entry["accusation_rewards"]
        row["double_baking_lost_rewards"] = \
            entry["lost_rewards"]
        row["double_baking_lost_fees"] = \
            entry["lost_fees"]
        row["double_baking_lost_deposits"] = \
            entry["lost_deposits"]
        data[delegate] = row

    for delegate in double_endorsement_data:
        row = empty_row() if delegate not in data else data[delegate]
        entry = double_endorsement_data[delegate]
        row["double_endorsement_accusation_rewards"] = \
            entry["accusation_rewards"]
        row["double_endorsement_lost_rewards"] = \
            entry["lost_rewards"]
        row["double_endorsement_lost_fees"] = \
            entry["lost_fees"]
        row["double_endorsement_lost_deposits"] = \
            entry["lost_deposits"]
        data[delegate] = row

    to_push = []
    for delegate in data:
        entry = data[delegate]
        row = Accusations(
            cycle = cycle,
            baker = delegate,
            double_endorsement_accusation_rewards = entry["double_endorsement_accusation_rewards"],
            double_baking_accusation_rewards = entry["double_baking_accusation_rewards"],
            double_endorsement_lost_fees = entry["double_endorsement_lost_fees"],
            double_endorsement_lost_deposits = entry["double_endorsement_lost_deposits"],
            double_endorsement_lost_rewards = entry["double_endorsement_lost_rewards"],
            double_baking_lost_fees = entry["double_baking_lost_fees"],
            double_baking_lost_deposits = entry["double_baking_lost_deposits"],
            double_baking_lost_rewards =  entry["double_baking_lost_rewards"]
            )
        to_push.append(row)
    return to_push


