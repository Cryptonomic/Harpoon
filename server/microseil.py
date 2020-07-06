import json, logging
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, Column, Integer, String, BigInteger, Numeric

def all_tables():
    return ["delegate_history", "snapshot_info",
            "baker_performance", "baker_payouts"]

def get_user_config():
    """Returns a dictionary containing config options loaded from 
    ./network_conf.json"""

    config = {}
    with open('network_conf.json', 'r') as f:
        config = json.loads(f.read())
    return config

def has_tables(tables, engine):
    """Returns a True/False based on if tables have been created in engine db"""

    exists = True
    for table in tables:
        exists = exists and engine.dialect.has_table(engine, table)
    return exists

Base = declarative_base()

class DelegateHistory(Base):
    """Wrapper for delegate_history table

    delegate_history records the delegates for all active bakers by cycle. The records
    are taken at the snapshot block level, meaning all delegates at cycle x for a
    given baker are used in baking rights for cycle x+7

    Attributes:
        cycle: (Column) Cycle at which delegate history was recorded
        snapshot_block_level: (Column) Block level at which delegate history was
            recorded (it is also the snapshot block for that level)
        delegator: (Column) Address of delegator to given baker
        baker: (Column) Address of baker
    """

    __tablename__ = "delegate_history"

    cycle = Column(Integer, primary_key=True)
    snapshot_block_level = Column(Integer)
    delegator = Column(String(255), primary_key=True)
    baker = Column(String(255))

class SnapshotInfo(Base):
    """Wrapper for snapshot_info table
    
    snapshot_info includes information relevant baker information at the snapshot level 
    of each cycle. The snapshot level is the block level at which roll balances are 
    recorded for use in calculating baking rights seven cycles later.

    Attributes:
        cycle: (Column) Cycle of the snapshot
        baker: (Column) Address of baker which snapshot info refers to
        snapshot_index: (Column) Value (0-15) used to calculate the snapshot level
        snapshot_block_level: (Column) Block level of the snapshot 
        staking_balance: (Column) Balance staked by baker at the snapshot level
        delegate_balance: (Column) Sum of the balance of all bakers delegators
        rewards: (Column) Total rewards made in the cycle
    """

    __tablename__ = "snapshot_info"


    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    snapshot_index = Column(Integer)
    snapshot_block_level = Column(Integer)
    staking_balance = Column(BigInteger)
    delegated_balance = Column(BigInteger)
    rewards = Column(BigInteger)
    
class BakerPerformance(Base):
    """Wrapper for baker_performance table
        
    baker_performance records metrics regarding block production and endorsements
    for each baker by cycle. 

    Attributes:
        cycle: (Column) Cycle which perfromance was recorded
        baker: (Column) Address of baker 
        num_baked: (Column) Number of blocks baked in cycle
        num_stolen: (Column) Number of stolen baked in cycle
        num_missed: (Column) Number of missed baked in cycle
        num_endorsements_in_baked: (Column) Sum of endorsing power of all blocks baked
        num_endorsements_in_stolen: (Column) Sum of endorsing power of all blocks stolen
        num_endorsements_in_missed: (Column) Sum of endorsing power of all blocks missed
        grade: (Column) Grade calculated from performance data
    """

    __tablename__ = "baker_performance"

    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    num_baked = Column(Integer)
    num_stolen = Column(Integer)
    num_missed = Column(Integer)
    num_endorsements_in_baked = Column(Integer)
    num_endorsements_in_stolen = Column(Integer)
    num_endorsements_in_missed = Column(Integer)
    grade = Column(Numeric)

class BakerPayouts(Base):
    """Wrapper for baker_payouts table
        
    baker_payouts stores the inferred payout account of each baker updated every cycle

    Attributes:
        cycle: (Column) Cycle which payout was recorded
        baker: (Column) Address of baker 
        payout: (Column) Address of payout account of baker
    """
    __tablename__ = "baker_payouts"

    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    payout = Column(String(255), primary_key=True)


def get_class_by_tablename(tablename):
    """Returns table wrapper class from name"""

    for c in Base._decl_class_registry.values():
        if hasattr(c, '__tablename__') and c.__tablename__ == tablename:
            return c

def get_column_by_name(tableclass, column):
    """Returns column wrapper class from table class and column name"""

    return getattr(tableclass, column)

def get_session():
    """Returns a new session to database specified in ./network_conf.json
    
    get_session() will create the necessary tables if they do not exists in the specified
    database. A new engine is created for each session
    """

    LOGIN = get_user_config()["db"]
    engine = create_engine('postgresql+psycopg2://%s:%s@%s:%s/%s' %
                           (LOGIN["user"], LOGIN["password"],
                            LOGIN["host"], LOGIN["port"],
                            LOGIN["database"]))
    if not has_tables(all_tables(), engine):
        Base.metadata.create_all(engine)

    Session = sessionmaker(engine)
    session = Session()
    return session
    





    


