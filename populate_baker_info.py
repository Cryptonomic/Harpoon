import psycopg2
import math, time
from conseil.api import ConseilApi
from conseil.core import ConseilClient as Client

conseil = Client(ConseilApi(
    api_key='galleon',
    api_host='https://conseil-prod.cryptonomic-infra.tech:443',
    api_version=2
))

accounts= conseil.tezos.mainnet.accounts
blocks = conseil.tezos.mainnet.blocks
delegates = conseil.tezos.mainnet.delegates
baking_rights = conseil.tezos.mainnet.baking_rights

def convertFromUtezToTez(num):
    return num / 1000000

    
currentBlockLevel = blocks.query(blocks.level).order_by(blocks.level.desc())\
                                              .limit(1).scalar()

def calc(baker, current_cycle):
    start_cycle = current_cycle - 10;
    b = blocks.query(blocks.hash, blocks.hash.count()) \
                      .filter(blocks.baker==baker)\
                      .filter(blocks.meta_cycle.between(start_cycle, current_cycle))\
                      .scalar()
    stakingBalance = convertFromUtezToTez(delegates.query(delegates.staking_balance) \
                                          .filter(delegates.pkh==baker) \
                                          .scalar())
    r = 0 if stakingBalance==0 else int(b)/stakingBalance
    d = accounts.query(accounts.delegate_value, accounts.delegate_value.count()) \
                .filter(accounts.delegate_value==baker) \
                .scalar()
    s = blocks.query(blocks.hash, blocks.hash.count()) \
              .filter(blocks.baker==baker,
                      blocks.priority>0, \
                      blocks.meta_cycle.between(start_cycle, current_cycle))\
              .scalar()

    rights = baking_rights.query(baking_rights.level) \
                          .filter(baking_rights.delegate==baker,
                                  baking_rights.priority==0,
                                  baking_rights.cycle.between(start_cycle, current_cycle)) \
                          .order_by(baking_rights.level.asc()) \
                          .limit(10000000) \
                          .vector()

    partitions = [i for i in range(0, len(rights), 5000)]
    if (len(rights) > 0 and partitions[-1] != len(rights)):
        partitions.append(len(rights))
    m = 0
    if (len(rights)>0):
        for i in range(len(partitions)-2):
            result = blocks.query(blocks.hash, blocks.hash.count()) \
                           .filter(blocks.level.in_(*rights[partitions[i]:partitions[i+1]]),
                                   blocks.baker!=baker) \
                           .limit(1000000) \
                           .scalar()
            m += int(result)
    r= float(r)
    b= int(b)
    s= int(s)
    m= int(m)
    d= int(d)
#    grade = stakingBalance
#    grade = b + s - m + d
    grade = (10000 * r) * ((b+s)/(1+b)) * (math.exp(-1* (m/(b+1))))*(1-(1/(1+d)))
    return baker, grade, current_cycle

def calculateGradesForCycle(cycle):
    start_cycle = cycle - 10
    bakers = list(set(blocks.query(blocks.baker) \
                 .filter(blocks.meta_cycle.between(start_cycle, cycle)) \
                 .vector()))
    data = []
    for baker in bakers:
        data.append(calc(baker, cycle))
    print(data)
    pushData(data);

def pushData(data):
    try:
        connection = psycopg2.connect(user = "postgres",
                                  password = "something",
                                  host = "127.0.0.1",
                                  port = "5433",
                                  database = "postgres")

        cursor = connection.cursor()
        postgres_insert_query = """INSERT INTO baking_info.baker_grades (address, grade, cycle) VALUES (%s, %s, %s)"""
        cursor.executemany(postgres_insert_query, data)
        connection.commit()
        print ("Commit changes")
    except (Exception, psycopg2.Error) as error :
        print ("Error while connecting to PostgreSQL", error)
    finally:
        if(connection):
            cursor.close()
            connection.close()
            print("PostgreSQL connection is closed")

def populate(starting_cycle):
    cycle = starting_cycle
    currentBlockCycle = blocks.query(blocks.meta_cycle).order_by(blocks.level.desc())\
                                                  .limit(1).scalar()
    while (True):
        print("Checking cycle")
        if cycle > currentBlockCycle:
            print("Up to date")
            time.sleep(60)
        else:
            print("Calculating...")
            calculateGradesForCycle(cycle)
            print("Done")
            cycle += 1

populate(242);
        
