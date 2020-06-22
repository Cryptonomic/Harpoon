CREATE SCHEMA baking_info
    AUTHORIZATION postgres;

CREATE TABLE baking_info.baker_grades
(
    cycle integer,
    address character varying(255) COLLATE pg_catalog."default",
    grade numeric
)

TABLESPACE pg_default;

ALTER TABLE baking_info.baker_grades
    OWNER to postgres;

CREATE TABLE baking_info.baker_payouts
(
    baker character varying(255) COLLATE pg_catalog."default",
    payout_account character varying(255) COLLATE pg_catalog."default"
)

TABLESPACE pg_default;

ALTER TABLE baking_info.baker_payouts
    OWNER to postgres;

CREATE TABLE baking_info.delegate_history
(
    cycle integer,
    snapshot_block_level integer,
    delegator character varying(255) COLLATE pg_catalog."default",
    baker character varying(255) COLLATE pg_catalog."default"
)

TABLESPACE pg_default;

ALTER TABLE baking_info.delegate_history
    OWNER to postgres;

CREATE TABLE baking_info.snapshot_info
(
    cycle integer,
    snapshot_index integer,
    snapshot_block_level integer,
    baker character varying(255) COLLATE pg_catalog."default",
    staking_balance bigint,
    delegated_balance bigint,
    rewards bigint
)

TABLESPACE pg_default;

ALTER TABLE baking_info.snapshot_info
    OWNER to postgres;
