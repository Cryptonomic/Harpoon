#!/usr/bin/env python
import requests, sys, json, psycopg2

from conseil.api import ConseilApi
from conseil.core import ConseilClient as Client

conseil = Client(ConseilApi(
    api_key='galleon',
    api_host='https://conseil-prod.cryptonomic-infra.tech:443',
    api_version=2
))

blocks = conseil.tezos.mainnet.blocks
delegates = conseil.tezos.mainnet.delegates

PRESERVED_CYCLES = 5
CYCLE_SIZE = 4096
SNAPSHOT_BLOCKS = 256
base = "http://157.245.219.171:8732/"



##get list of delgators and staking balance for cycle n by going to snapshot block level -1
##delegator gets balance at snapshot block level -1

def getData(delegate, cycle, cycle2="none"):
    if cycle2 == "none":
        cycle2 = cycle
    ret = []
    try:
        connection = psycopg2.connect(user = "postgres",
                                  password = "something",
                                  host = "127.0.0.1",
                                  port = "5433",
                                  database = "postgres")

        cursor = connection.cursor()
        cursor.execute("SELECT cycle, rewards, staking_balance, snapshot_block_level FROM \
        baking_info.snapshot_info WHERE cycle BETWEEN " + cycle + " AND " + cycle2 + " AND baker='" + delegate + "';")

        record = cursor.fetchall()
        ret = record;
    except (Exception, psycopg2.Error) as error :
        print ("Error while connecting to PostgreSQL", error)
    finally:
        if(connection):
            cursor.close()
            connection.close()
            return ret


baker = str(sys.argv[1])
cycle = str(sys.argv[2])
rewardsInfo = []
if len(sys.argv) == 4:
    rewardsInfo = getData(baker, cycle, str(sys.argv[3]))
else:
    rewardsInfo = getData(baker, cycle)

ret = []
for data in rewardsInfo:
    ret.append({"cycle": data[0],
                "rewards": data[1],
                "staking_balance": data[2],
                "snapshot_level": data[3]})

print(json.dumps(ret))
