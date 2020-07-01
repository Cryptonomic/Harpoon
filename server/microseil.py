import json, logging
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, Column, Integer, String, BigInteger

def get_user_config():
    config = {}
    with open('network_conf.json', 'r') as f:
        config = json.loads(f.read())
    return config

def has_tables(tables, engine):
    exists = True
    for table in tables:
        exists = exists and engine.dialect.has_table(engine, table)
    return exists

TABLES = ["delegate_history", "snapshot_info", "baker_performance"]
LOGIN = get_user_config()["db"]
engine = create_engine('postgresql+psycopg2://%s:%s@%s:%s/%s' %
                       (LOGIN["user"], LOGIN["password"],
                        LOGIN["host"], LOGIN["port"],
                        LOGIN["database"]))

Base = declarative_base()

class DelegateHistory(Base):
    __tablename__ = "delegate_history"

    cycle = Column(Integer, primary_key=True)
    snapshot_block_level = Column(Integer)
    delegator = Column(String(255), primary_key=True)
    baker = Column(String(255))

class SnapshotInfo(Base):
    __tablename__ = "snapshot_info"

    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    snapshot_index = Column(Integer)
    snapshot_block_level = Column(Integer)
    staking_balance = Column(BigInteger)
    delegated_balance = Column(BigInteger)
    rewards = Column(BigInteger)
    
class BakerPerformance(Base):
    __tablename__ = "baker_performance"

    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    num_baked = Column(Integer)
    num_stolen = Column(Integer)
    num_missed = Column(Integer)
    num_endorsements_in_baked = Column(Integer)
    num_endorsements_in_stolen = Column(Integer)
    num_endorsements_in_missed = Column(Integer)
    grade = Column(Integer)

def get_class_by_tablename(tablename):
  for c in Base._decl_class_registry.values():
    if hasattr(c, '__tablename__') and c.__tablename__ == tablename:
      return c

def get_column_by_name(tableclass, column):
    return getattr(tableclass, column)

def get_session():
    Session = sessionmaker(engine)
    session = Session()
    return session
    
if __name__ == "__main__":
    if not has_tables(TABLES, engine):
        logging.debug("Creating tables...")
        Base.metadata.create_all(engine)





    


