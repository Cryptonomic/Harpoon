# Harpoon
Harpoon is a staking dashboard for Tezos built using ConseilJS. Harpoon collects metrics about each baker on the Tezos network and allows users to search for and evaluate bakers based off of these performance stats. This data includes blocks baked, missed, and stolen, stake relative to the rest of the network, as well as a letter grade based on a normalized scoring system. Harpoon also allows for a user to view and audit the rewards won/payed out by bakers. 

## Installing and Running
Harpoon can be downloaded and configured using the following commands:
```
git clone https://github.com/Cryptonomic/Harpoon.git
cd Harpoon
python3 configure.py
```
Doing so will launch a configuration script that will allow the user to enter various config details and automatically creates the necessary config files. It is recommended to specify a sync start cycle that is at least 8 cycles before the current cycle for all of the features to work correctly.

After configuration, Harpoon can be run through [Docker](https://docs.docker.com/engine/install/) using the following commands:
```
docker-compose up --build
```
Doing so will result in an endpoint at http://127.0.0.1:<web_server_port>, where `web_server_port` was the values specified during configuration. A Postgres database is also accessible through the corresponding port specified during configuration a well.

On startup, Harpoon will display metrics for the most recent baker. Other bakers can be searched for by baker name or public key hash 
Some features, such as letter grades and rewards will be unable, however, as syncing the Postgres database requires some time to do. 
