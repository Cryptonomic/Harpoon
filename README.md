# Harpoon
Harpoon is a staking dashboard for Tezos built using ConseilJS. Harpoon collects metrics about each baker on the Tezos network and allows users to search for and evaluate bakers based off of these performance stats. This data includes blocks baked, missed, and stolen, stake relative to the rest of the network, as well as a letter grade based on a normalized scoring system. Harpoon also allows for a user to view and audit the rewards won/payed out by bakers. 
## Installation
Harpoon can be run through (Docker)[https://docs.docker.com/engine/install/] using the following commands:
```
git clone https://github.com/Cryptonomic/Harpoon.git
cd Harpoon
docker-compose up --build
```
Doing so will result in an endpoint at http://127.0.0.1:8080, as well as a Postgres database accessible through port 5434. 
On startup, Harpoon will display metrics for the most recent baker. Some features, such as letter grades and rewards will be unable, however, as syncing the Postgres database requires some time to do.
The default cycle to start syncing from is set to `230`. This value can be changed in docker-compose.yml by changing the value of `command` to the desired start cycle. It is recommended to at least start the sync from 8 cycles before the current cycle for all of the features to work correctly.
