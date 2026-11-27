-- db/legacy-template/20240923001430_create_sexs.sql
-- migrate:up

CREATE TABLE sexs (
  id	SERIAL PRIMARY KEY,
  name	VARCHAR(7)
);

-- migrate:down

DROP TABLE IF EXISTS sexs;
