#!/usr/bin/env python
import psycopg2, sys, json
try:
    connection = psycopg2.connect(user = "postgres",
                                  password = "something",
                                  host = "127.0.0.1",
                                  port = "5433",
                                  database = "postgres")
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM baking_info.baker_grades WHERE cycle=" + str(sys.argv[1]) + ";")
    record = cursor.fetchall()
    data = []
    for r in record:
        data.append({"address": r[1], "grade": float(r[2])});
    print(json.dumps(data, sort_keys=True))

except (Exception, psycopg2.Error) as error :
    print ("Error while connecting to PostgreSQL", error)
finally:
    if(connection):
        cursor.close()
        connection.close()


