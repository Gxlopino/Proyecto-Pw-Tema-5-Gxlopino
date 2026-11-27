-- db/legacy-template/20240923001723_create_goalkeeper_details.sql
-- migrate:up

CREATE TABLE goalkeeper_details (
  id	SERIAL PRIMARY KEY,
  diving INTEGER,
  handling INTEGER,
  kicking INTEGER,
  positioning INTEGER,
  reflexes INTEGER,
  player_id	INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players (id)
);

-- migrate:down

DROP TABLE IF EXISTS goalkeeper_details;
