# Harpoon
A Tezos staking dashboard built using ConseilJS

## Installation
Python 3.7+ is recommended. Before running, make sure cherrypy and cherrypy-cors is installed:

```
python3 -m pip install cherrypy
python3 -m pip install cherrypy-cors
```
Conseilpy is also required. To install run:

```
python3 -m pip install conseil
```
Access to a postgres server is also needed for many functions. You can find more information about how to set one up [here](https://www.postgresql.org/). 

To download and run initial setup procedures, run:

```
git clone https://github.com/Cryptonomic/Harpoon.git
python3 Harpoon/setup.py
```
After following the prompts, the necessary configuration files for the database and conseil server should have been created. 

## Running Harpoon
In order to start the server, run:
```
python3 Harpoon/server.py
```
Doing so should open an endpoint at http://127.0.0.1:8080/. Some functions, such as baker grades, rewards and payouts will be unavailable since the databases used to collect such data has not been populated yet. To do so, run:
```
python3 Harpoon/services/populate_baker_info.py <start_cycle> &
python3 Harpoon/services/populate_staking_info.py <start_cycle> &
python3 Harpoon/services/populate_delegate_history.py <start_cycle> &
```
replacing `<start_cycle>` with the desired cycle to start the sync from. It is recommended to start the scripts at least 8 cycles before the current cycle, although some functionality will still work if a more recent start point is used. 

