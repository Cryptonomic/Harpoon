# Harpoon

Harpoon is a staking dashboard for the Tezos blockchain built using [ConseilJS](https://github.com/Cryptonomic/ConseilJS). Harpoon collects metrics about each baker on the Tezos network and allows users to search for and evaluate bakers based on these performance stats. The data includes blocks baked, missed, and stolen, stake relative to the rest of the network, as well as a letter grade based on a normalized scoring system. Harpoon also enables baker auditing by showing the rewards won and paid out. [Cryptonomic](https://twitter.com/cryptonomictech) has a public deployment of [Harpoon](https://harpoon.arronax.io/) under the [Arronax](https://harpoon.arronax.io/) umbrella of blockchain analytics products.

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

Doing so will result in an endpoint at `http://127.0.0.1:<web_server_port>`, where `web_server_port` was the value specified during configuration. A Postgres database is also accessible through the corresponding port specified during configuration a well.

On startup, Harpoon will display metrics for the most recent baker. Other bakers can be searched for by baker name or public key hash
Some features, such as letter grades and rewards will be unable, however, as syncing the Postgres database requires some time to do.

## How It Works

Much of the functionality of Harpoon is achieved through client-side javascript using [ConseilJS](https://www.npmjs.com/package/conseiljs), such as the stats on the top left panel that provide an outline for the baker's performance in the last cycle. However, for information that is data intensive or not available through [Conseil](https://github.com/Cryptonomic/Conseil), a database is maintained and kept up-to-date with [additional indexing scripts](https://github.com/Cryptonomic/Harpoon/tree/master/server) in Python. The following sections provide an overview for some of the less conventional pieces of information that are collected.

### Snapshot Data

Every cycle in the Tezos blockchain has a snapshot index associated with it. This index is a value chosen at random from 0-15 and used to pick one of sixteen roll balance snapshots taken `PRESERVED_CYCLES - 2 = 7` cycles behind. This balance snapshot is then used to determine baking rights thus making it important in various aspects of baking.

Many of the mechanisms in Harpoon reference the following values:

- `snapshot_index`: a random value (0-15) used to pick the snapshot
- `snapshot_block_level`: the level number of the snapshot used in a cycle
- `snapshot_level`: the level one block before the snapshot block

Given the snapshot index of a cycle x, `snapshot_block_level` can be calculated with the following logic.

1. `(x - PRESERVED_CYCLES - 2) * CYCLE_SIZE` gives the level of the first block of the cycle which the snapshot_index was used in (cycle x-7)
2. `(snapshot_index + 1) * SNAPSHOT_BLOCKS` gives the level position of the snapshot in the cycle. Since there are only 16 evenly spaced snapshots per cycle, a snapshot is taken every `BLOCKS_PER_CYCLE/16 = SNAPSHOT_BLOCKS` blocks. In the current mainnet, this value is `256`.

Thus, the snapshot block used for for cycle x would be:  
`(x - PRESERVED_CYCLES - 2) * CYCLE_SIZE + (snapshot_index + 1) * SNAPSHOT_BLOCKS`

The snapshot taken at the snapshot block only contains the rolls which each baker had at that point, however. The balances for all accounts in the snapshot are the values before the operations in the snapshot block have settled. `snapshot_level` which is just `snapshot_block_level - 1` , is thus used to get all of the necessary balance data

### Baker Grade Calculation

Bakers are scored based on their baking and endorsing performance from the last four periods. A baker should have ideally baked/endorsed in at least 30 cycles for a reliable grade. However, they can still be graded if they have baked/endorsed in at least 15 cycles (there will be an asterisk next to their grade if this is the case). Read about how works in more detail [here](https://drive.google.com/file/d/1niqTEY4t_CjrS3WWGYBTeGh3soBS2Qz1/view?usp=sharing).

### Delegate History

Delegate history is not pulled through Conseil in order to have more fine grained control over when the data is recorded. In order to ensure accuracy in baker payout calculations, the delegate history is also taken at the `snapshot_level` for every cycle.
