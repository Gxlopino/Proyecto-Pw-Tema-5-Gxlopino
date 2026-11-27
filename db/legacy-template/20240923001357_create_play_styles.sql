-- db/legacy-template/20240923001357_create_play_styles.sql
-- migrate:up

CREATE TABLE play_styles (
  id	SERIAL PRIMARY KEY,
  name	VARCHAR(30)
);

-- migrate:down

DROP TABLE IF EXISTS play_styles;
