import postgres

print("===============================")
print("Postgres Database Configuration")
print("===============================\n")
postgres.configure()
postgres.create_tables(postgres.get_login())
