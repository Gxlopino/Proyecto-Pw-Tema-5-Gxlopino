-- db/legacy-template/20240923001454_create_positions.sql
-- migrate:up

CREATE TABLE positions (
  id	SERIAL PRIMARY KEY,
  name	VARCHAR(10)
);

-- migrate:down

DROP TABLE IF EXISTS positions;
