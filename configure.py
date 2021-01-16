def fill_template(path, mapping):
    file_str = ""
    with open(path, "r") as f:
        file_str = f.read()
        for key in mapping:
            file_str = file_str.replace("<%s>" % key, mapping[key])
    path = path.replace(".default", "")
    with open(path, "w+") as f:
        f.write(file_str)

if __name__ == "__main__":
    print("====Harpoon Config====")

    conseil_host = input("Conseil host server: ")
    conseil_port = input("Conseil host port: ")
    api_key = input("Conseiljs api key: ")
    tezos_host = input("Tezos host server: ")
    tezos_port = input("Tezos host port: ")
    host_db_port = input("Host database port: ")
    db_pass = input("Database password: ")
    host_web_port = input("Host web server port: ")
    start_cycle = input("Sync start cycle: ")

    MAPPING = {
        "conseil_host": conseil_host,
        "conseil_port": conseil_port,
        "api_key": api_key,
        "tezos_host": tezos_host,
        "tezos_port": tezos_port,
        "host_db_port": host_db_port,
        "db_password": db_pass,
        "host_web_port": host_web_port,
        "start_cycle": start_cycle
    }

    FILES = ["./docker-compose.default.yml",
             "./ui/assets/networkConf.default.js",
             "./server/network_conf.default.json"]

    for f in FILES:
        fill_template(f, MAPPING)
