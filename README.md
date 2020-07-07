# Harpoon
Harpoon is a staking dashboard for Tezos built using ConseilJS. Harpoon collects metrics about each baker on the Tezos network and allows users to search for and evaluate bakers based off of these performance stats. This data includes blocks baked, missed, and stolen, stake relative to the rest of the network, as well as a letter grade based on a normalized scoring system. Harpoon also allows for a user to view and audit the rewards won/payed out by bakers. 

## Requirements
[Docker](https://docs.docker.com/engine/install/) and [Docker-compose](https://docs.docker.com/compose/install/) are the only two requirements needed to run Harpoon

## Installing and Running
Harpoon can be downloaded and configured using the following commands:
```bash
git clone https://github.com/Cryptonomic/Harpoon.git
cd Harpoon
python3 configure.py
```
Doing so will launch a configuration script that will allow the user to enter various config details and automatically creates the necessary config files. It is recommended to specify a sync start cycle that is at least 8 cycles before the current cycle for all of the features to work correctly.

After configuration, Harpoon can be run through [Docker](https://docs.docker.com/engine/install/) using the following commands:
```bash
docker-compose up --build
```
Doing so will result in an endpoint at http://127.0.0.1:<web_server_port>, where `web_server_port` was the values specified during configuration. A Postgres database is also accessible through the corresponding port specified during configuration a well.

On startup, Harpoon will display metrics for the most recent baker. Other bakers can be searched for by baker name or public key hash 
Some features, such as letter grades and rewards will be unable, however, as syncing the Postgres database requires some time to do. 

## How It Works

Much of the functionality of Harpoon is achieved through client-side javascript using ConsielJS, such as the stats on the top left panel that provide an outline for the baker's performance in the last cycle. However, for information that is data intensive or not available through Consiel, a database is maintained and kept up to date by server side python scripts. The following sections provide an overview for some of the less conventional pieces of information are collected. 

### Snapshot Data

Every cycle in the Tezos blockchain has a snapshot index associated with it. This index is a value chosen at random from 0-15 and used to pick one of sixteen roll balance snapshots taken `PRESERVED_CYCLES - 2` = 7 cycles behind. This balance snapshot is then used to determine baking rights thus making it important in various aspects of baking. 

Many of the mechanisms in Harpoon reference the following values:

`snapshot_index`: a random value (0-15) used to pick the snapshot

`snapshot_block_level`: the level number of the snapshot used in a cycle

`snapshot_level`: the level one block before the snapshot block

Given the snapshot index of a cycle x, `snapshot_block_level` can be used with the following logic.

`(x - PRESERVED_CYCLES - 2) * CYCLE_SIZE` gives the level of the first block of the cycle which the snapshot_index was used in (cycle x-7)
 
`(snapshot_index + 1) * SNAPSHOT_BLOCKS` gives the level position of the snapshot in the cycle. Since there are only 16 evenly spaced snapshots per cycle, a snapshot is taken every `BLOCKS_PER_CYCLE/16 = SNAPSHOT_BLOCKS` blocks. In the current mainnet, this value is `256`.

Thus, the snapshot block used for for cycle x would be:
`(x - PRESERVED_CYCLES - 2) * CYCLE_SIZE + (snapshot_index + 1) * SNAPSHOT_BLOCKS`

The snapshot taken at the snapshot block only contains the rolls which each baker had at that point, however. The balances for all accounts in the snapshot are the values before the operations in the snapshot block have settled. `snapshot_level` which is just `snapshot_block_level - 1` , is thus used to get all of the necessary balance data

### Baker Grade Calculation

Baker are scored once at the end of every cycle. The formula used to calculate this score can be interacted with [here] (https://www.desmos.com/calculator/p419kfvxpk).

As of now, endorsement data has not been factored into grading yet.

## Delegate History

Delegate history is not pulled through Conseil in order to have more fine grain control over when the data is recorded. In order to ensure accuracy in baker payout calculations, the delegate history is also taken at the `snapshot_level` for every cycle






