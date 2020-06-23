import psycopg2, json
def connect(db):
    with  psycopg2.connect(user = db["user"],
                           password = db["password"],
                           host = db["host"],
                           port = db["port"],
                           database = db["database"]) as connection:
        return connection

def push(db, table, columns, data):
    connection = connect(db)
    cursor = connection.cursor()
    postgres_insert_query = """INSERT INTO %s %s VALUES %s""" % \
        (table,
         str(columns).replace("'", ""),
         str(tuple("%s" for _ in columns)).replace("'", ""))
    
    cursor.executemany(postgres_insert_query, data)
    connection.commit()

def create_tables(db):
    connection = connect(db)
    cursor = connection.cursor()
    with open("create_tables.sql", "r") as f:
        print("Creating tables...")
        cursor.execute(f.read())
        connection.commit()
    print("Postgres database is setup")

def get_login(dbfile="db_conf.json"):
    db = {}
    with open(dbfile, 'r') as f:
        db = json.loads(f.read())
    return db

def configure():
    with open("db_conf.json", "w+") as f:
        host = input("Postgres host IP: ")
        port = input("Port: ")
        user = input("User: ")
        password = input("Password: ")
        database = input("Database: ")
        db = {"user": user,
              "password": password,
              "host": host,
              "port": port,
              "database": database}

        f.write(json.dumps(db, indent=4))


if __name__ == "__main__":
    configure()
