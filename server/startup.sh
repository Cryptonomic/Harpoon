#!/bin/bash
while !</dev/tcp/db/5432;
do
    echo "Waiting for Postgres to start...";
    sleep 1;
done;
python3 microseil.py
python3 populate_baker_performance.py $1 &
python3 populate_staking_info.py $1 &
python3 populate_delegate_history.py $1 &
python3 server.py 
