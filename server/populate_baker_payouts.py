import sys
import requests
import json
import service_utils
import queries as tezos
from microseil import BakerPayouts


def max_source(sources):
    """Returns the source with the most transactions from an array of dicts"""

    largest_source = ""
    max_count = 0
    for source in sources:
        if sources[source] > max_count:
            largest_source = source
            max_count = sources[source]
    return largest_source


def get_payout_delay(baker):
    """Queries Baking Bad for the number of cycles before payouts are sent"""

    response = requests.get("https://api.baking-bad.org/v2/bakers/%s" % baker)
    if not response.text:
        return 0
    return int(json.loads(response.text)["payoutDelay"])


def count_sources(receiver_list, cycle):
    """Looks through receiver_list and accumulates a tally of the sources of
    transactions

    Args:
        reciever_list: ([String]) List of addresses to accumulate transaction
        sources for
        cycle: (int) Cycle number of the transactions to look in

    Returns:
        {"source": count} A dictionary where the keys ("source") are the
        addresses of transaction sources and values (count) are the number of
        times the corresponding key was a source that sent a transaction to a
        member of receiever_list
    """

    source_count = {}
    for delegator in receiver_list:
        sources = set(tezos.transaction_sources_in_cycle(delegator, cycle))
        for source in sources:
            if source not in source_count:
                source_count[source] = 1
            else:
                source_count[source] += 1
    return source_count


@service_utils.populate_from_cycle()
def populate_baker_payouts(cycle):
    """Populates baker_payouts table with data for each baker at given cycle"""

    print("Acquiring payout accounts for cycle %s..." % cycle)

    bakers = tezos.all_bakers()
    data = []
    for baker in bakers:
        payout_delay = get_payout_delay(baker)
        snapshot_index = tezos.snapshot_index(cycle)
        snapshot_level = tezos.snapshot_index_to_block(snapshot_index, cycle) - 1
        baker_info = tezos.baker_info_at_level(baker, snapshot_level)
        if "delegated_contracts" not in baker_info:
            continue
        source_count = count_sources(baker_info["delegated_contracts"],
                                     cycle-payout_delay)
        data.append(BakerPayouts(cycle=cycle,
                                 baker=baker,
                                 payout=max_source(source_count)))
    return data

