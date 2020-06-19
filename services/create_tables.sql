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

CREATE TABLE baking_info.snapshot_info
(
    cycle integer,
    snapshot_index integer,
    snapshot_block_level integer
)

TABLESPACE pg_default;

ALTER TABLE baking_info.snapshot_info
    OWNER to postgres;
