-- db/legacy-template/20240923001537_create_teams.sql
-- migrate:up

CREATE TABLE teams (
  id	SERIAL PRIMARY KEY,
  name	VARCHAR(40),
  league_id	INTEGER NOT NULL,
  FOREIGN KEY (league_id) REFERENCES leagues (id)
);

-- migrate:down

DROP TABLE IF EXISTS teams;
