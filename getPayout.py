#!/usr/bin/env python
import requests, sys, json, psycopg2

def getData(delegate):
    ret = []
    try:
        connection = psycopg2.connect(user = "postgres",
                                  password = "something",
                                  host = "127.0.0.1",
                                  port = "5433",
                                  database = "postgres")

        cursor = connection.cursor()
        cursor.execute("SELECT payout_account staking_balance FROM baking_info.baker_payouts WHERE baker='" + delegate + "';");
        ret = cursor.fetchone()
    except (Exception, psycopg2.Error) as error :
        print ("Error while connecting to PostgreSQL", error)
    finally:
        if(connection):
            cursor.close()
            connection.close()
            return ret[0]

print(json.dumps({"address":getData(str(sys.argv[1]))}))
