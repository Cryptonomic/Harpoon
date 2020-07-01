def fill_template(path, mapping):
    with open(path, "r+") as f:
        file_str = f.read()
        for key in mapping:
            file_str = file_str.replace("<%s>" % key, mapping[key])
        f.seek(0)
        f.write(file_str)
        f.truncate()

if __name__ == "__main__":
    print("====Harpoon Config====")

    db_pass = input("Database password: ")
    api_key = input("Conseiljs api key: ")
    conseil_host = input("Conseil host server: ")
    tezos_host = input("Tezos host server: ")
    tezos_port = input("Tezos host port: ")
    host_db_port = input("Host database port: ")
    host_web_port = input("Host web server port: ")
    start_cycle = input("Sync start cycle: ")

    MAPPING = {
        "db_password": db_pass,
        "api_key": api_key,
        "conseil_host": conseil_host,
        "tezos_host": tezos_host,
        "tezos_port": tezos_port,
        "host_db_port": host_db_port,
        "host_web_port": host_web_port,
        "start_cycle": start_cycle
    }

    FILES = ["./docker-compose.yml",
             "./ui/assets/networkConf.js",
             "./server/network_conf.json"]

    for f in FILES:
        fill_template(f, MAPPING)
