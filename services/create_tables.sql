CREATE SCHEMA baking_info
    AUTHORIZATION postgres;

CREATE TABLE baking_info.baker_performance
(
    cycle integer NOT NULL,
    address character varying(255) COLLATE pg_catalog."default" NOT NULL,
    grade numeric,
    CONSTRAINT baker_grades_pkey PRIMARY KEY (cycle, address)
)

TABLESPACE pg_default;

ALTER TABLE baking_info.baker_performance
    OWNER to postgres;

CREATE TABLE baking_info.baker_payouts
(
    baker character varying(255) COLLATE pg_catalog."default",
    payout_account character varying(255) COLLATE pg_catalog."default",
    cycle integer
)

TABLESPACE pg_default;

ALTER TABLE baking_info.baker_payouts
    OWNER to postgres;

CREATE TABLE baking_info.delegate_history
(
    cycle integer NOT NULL,
    snapshot_block_level integer,
    delegator character varying(255) COLLATE pg_catalog."default" NOT NULL,
    baker character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT delegate_history_pkey PRIMARY KEY (cycle, delegator)
)

TABLESPACE pg_default;

ALTER TABLE baking_info.delegate_history
    OWNER to postgres;

CREATE TABLE baking_info.snapshot_info
(
    cycle integer NOT NULL,
    snapshot_index integer,
    snapshot_block_level integer,
    baker character varying(255) COLLATE pg_catalog."default" NOT NULL,
    staking_balance bigint,
    delegated_balance bigint,
    rewards bigint,
    CONSTRAINT snapshot_info_pkey PRIMARY KEY (cycle, baker)
)

TABLESPACE pg_default;

ALTER TABLE baking_info.snapshot_info
    OWNER to postgres;
