-- db/legacy-template/20240923001519_create_foots.sql
-- migrate:up

CREATE TABLE foots (
  id	SERIAL PRIMARY KEY,
  name	VARCHAR(6)
);

-- migrate:down

DROP TABLE IF EXISTS foots;
