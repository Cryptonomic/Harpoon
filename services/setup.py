import postgres

postgres.configure()
postgres.create_tables(db.get_login())
