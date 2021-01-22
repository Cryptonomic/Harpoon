import json
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, func, Column, Integer, String, \
    BigInteger, Numeric

Base = declarative_base()


class DelegateHistory(Base):
    """Wrapper for delegate_history table

    delegate_history records the delegates for all active bakers by cycle. The
    records are taken at the snapshot block level, meaning all delegates at
    cycle x for a given baker were used for baking rights in that cycle

    Attributes:
        cycle: (Column) Cycle at which delegate history was recorded
        snapshot_block_level: (Column) Block level at which delegate history
            was recorded (it is also the snapshot block for that level)
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

    snapshot_info includes information relevant baker information at the
    snapshot level of each cycle. The snapshot level is the block level at
    which roll balances are recorded for use in calculating baking rights seven
    cycles later.

    Attributes:
        cycle: (Column) Cycle of the snapshot
        baker: (Column) Address of baker which snapshot info refers to
        snapshot_index: (Column) Value (0-15) used to get the snapshot level
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

    baker_performance records metrics regarding block production and
    endorsements for each baker by cycle.

    Attributes:
        cycle: (Column) Cycle which performance was recorded
        baker: (Column) Address of baker
        num_baked: (Column) Number of blocks baked in cycle
        num_stolen: (Column) Number of stolen baked in cycle
        num_missed: (Column) Number of missed baked in cycle
        fees_in_baked: (Column) Sum of fees in blocks baked in cycle (mutez)
        fees_in_stolen: (Column) Sum of fees in blocks stolen in cycle (mutez)
        fees_in_missed: (Column) Sum of fees in blocks missed in cycle (mutez)
        num_endorsements_in_baked: (Column) Sum endorsements in baked blocks
        num_endorsements_in_stolen: (Column) Sum endorsements in stolen blocks
        num_endorsements_in_missed: (Column) Sum endorsements in missed blocks
        high_priority_endorsements: (Column) Number of endorsements made with
            blocks that were priority 0
        low_priority_endorsements: (Column) Number of endorsements made with
            blocks that were greater than priority 0
        missed_endorsements: (Column) Number of endorsements missed in cycle
        num_revelations_in_baked: (Column) Count revelations in baked blocks
        num_revelations_in_stolen: (Column) Count revelations in stolen blocks
        num_revelations_in_missed: (Column) Count revelations in missed blocks
        num_nonces_not_revealed = (Column) Count nonces not revealed
        endorsements_in_not_revealed = (Column) Count endorsements in blocks
            where the nonce was not revealed by baker
        fees_in_not_revealed = (Column) Sum fess in blocks where nonce was not
            revealed by baker
        grade: (Column) Grade calculated from performance data
    """

    __tablename__ = "baker_performance"

    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    num_baked = Column(Integer)
    num_stolen = Column(Integer)
    num_missed = Column(Integer)
    fees_in_baked = Column(BigInteger)
    fees_in_stolen = Column(BigInteger)
    fees_in_missed = Column(BigInteger)
    num_endorsements_in_baked = Column(Integer)
    num_endorsements_in_stolen = Column(Integer)
    num_endorsements_in_missed = Column(Integer)
    high_priority_endorsements = Column(Integer)
    low_priority_endorsements = Column(Integer)
    missed_endorsements = Column(Integer)
    num_revelations_in_baked = Column(Integer)
    num_revelations_in_stolen = Column(Integer)
    num_revelations_in_missed = Column(Integer)
    num_nonces_not_revealed = Column(Integer)
    endorsements_in_not_revealed = Column(Integer)
    fees_in_not_revealed = Column(Integer)
    grade = Column(String(255))


class Accusations(Base):
    """Wrapper for accusation table

    accusations records the gains/ losses in cycles where accusations took
    place. Cycles without any accusations are omitted

    Attributes:
        cycle: (Column) Cycle which accusation was recorded
        baker: (Column) Address of baker
        double_endorsement_accusation_rewards: (Column) Rewards from accusing
            a baker of double endorsing
        double_baking_accusation_rewards: (Column) Rewards from accusing
            a baker of double baking
        double_endorsement_lost_fees: (Column) Total fees lost from double
            endorsing
        double_endorsement_lost_deposits: (Column) Total deposits lost from
            double endorsing
        double_endorsement_lost_rewards: (Column) Total rewards lost from
            double endorsing
        double_baking_lost_fees: (Column) Total fees lost from double baking
        double_baking_lost_deposits: (Column)  Total deposits lost from double
            baking
        double_baking_lost_rewards: (Column)  Total rewards lost from double
            baking
    """
    
    __tablename__ = "accusations"
    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    double_endorsement_accusation_rewards = Column(BigInteger)
    double_baking_accusation_rewards = Column(BigInteger)
    double_endorsement_lost_fees = Column(BigInteger)
    double_endorsement_lost_deposits = Column(BigInteger)
    double_endorsement_lost_rewards = Column(BigInteger)
    double_baking_lost_fees = Column(BigInteger)
    double_baking_lost_deposits = Column(BigInteger)
    double_baking_lost_rewards = Column(BigInteger)

    
class BakerPayouts(Base):
    """Wrapper for baker_payouts table

    baker_payouts stores the inferred payout account of each baker updated
    every cycle

    Attributes:
        cycle: (Column) Cycle which payout was recorded
        baker: (Column) Address of baker
        payout: (Column) Address of payout account of baker
    """
    __tablename__ = "baker_payouts"

    cycle = Column(Integer, primary_key=True)
    baker = Column(String(255), primary_key=True)
    payout = Column(String(255), primary_key=True)


def all_tables():
    return ["delegate_history", "snapshot_info",
            "baker_performance", "baker_payouts",
            "accusations"]


def get_user_config():
    """Returns a dictionary containing config options loaded from
    ./network_conf.json"""

    config = {}
    with open('network_conf.json', 'r') as f:
        config = json.loads(f.read())
    return config


def has_tables(tables, engine):
    """Returns a True/False based on if tables have been created in engine"""

    exists = True
    for table in tables:
        exists = exists and engine.dialect.has_table(engine, table)
    return exists


def get_engine():
    """Returns sqlalchemy engine to connect to db"""

    login = get_user_config()["db"]
    engine = create_engine('postgresql+psycopg2://%s:%s@%s:%s/%s' %
                           (login["user"], login["password"],
                            login["host"], login["port"],
                            login["database"]))
    return engine


def create_tables():
    engine = get_engine()
    if not has_tables(all_tables(), engine):
        Base.metadata.create_all(engine)


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

    get_session() will create the necessary tables if they do not exists in the
    specified database. A new engine is created for each session
    """
    engine = get_engine()
    Session = sessionmaker(engine)
    session = Session()
    return session


if __name__ == "__main__":
    create_tables()
