import psycopg2, json
def connect():
    with  psycopg2.connect(user = "postgres",
                           password = "password",
                           host = "db",
                           port = "5432",
                           database = "postgres") as connection:
        return connection

def push(table, columns, data):
    connection = connect()
    cursor = connection.cursor()
    postgres_insert_query = """INSERT INTO %s %s VALUES %s""" % \
        (table,
         str(columns).replace("'", ""),
         str(tuple("%s" for _ in columns)).replace("'", ""))

    cursor.executemany(postgres_insert_query, data)
    connection.commit()

def create_tables():
    connection = connect()
    cursor = connection.cursor()
    print("Creating tables...")
    with open("create_tables.sql", "r") as f:
        cursor.execute(f.read())
        connection.commit()
    print("Postgres tables created")


if __name__ == "__main__":
    create_tables()
