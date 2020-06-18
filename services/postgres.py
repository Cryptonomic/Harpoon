import psycopg2, json
def push(db, table, columns, data):
    with  psycopg2.connect(user = db["user"],
                           password = db["password"],
                           host = db["host"],
                           port = db["port"],
                           database = db["database"]) as connection:
        
        cursor = connection.cursor()
        postgres_insert_query = """INSERT INTO %s %s VALUES %s""" % \
            (table,
             str(columns).replace("'", ""),
             str(tuple("%s" for _ in columns)).replace("'", ""))

        cursor.executemany(postgres_insert_query, data)
        connection.commit()

def getLogin(dbfile):
    db = {}
    with open(dbfile, 'r') as f:
        db = json.loads(str(f.read()))
    return db
