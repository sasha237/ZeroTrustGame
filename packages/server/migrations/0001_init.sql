-- Balance of Terror M2 — initial schema (Postgres 16)
-- Mirrors WORKING_PLAN.md §10. Only FKs + unique constraints; no extra indexes at this scale.

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
  id            uuid PRIMARY KEY,
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id         uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE games (
  id              uuid PRIMARY KEY,
  ruleset_version text NOT NULL,
  status          text NOT NULL DEFAULT 'open', -- open | active | finished
  invite_code     text UNIQUE NOT NULL,
  created_by      uuid NOT NULL REFERENCES users(id),
  result          jsonb,
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_players (
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side    text NOT NULL, -- 'state' | 'terrorist'
  PRIMARY KEY (game_id, user_id)
);

CREATE TABLE turns (
  game_id          uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  turn             int NOT NULL,
  state_orders     jsonb,  -- NULL until that side submits; never exposed while hidden
  terrorist_orders jsonb,
  summary          jsonb,  -- EffectLogEntry[] + EconomyLine[] + events after resolution
  state_after      text NOT NULL, -- serializeState snapshot (post-resolution once resolved)
  resolved_at      timestamptz,
  PRIMARY KEY (game_id, turn)
);
-- schema_migrations is created and owned by the migrator (db.ts), not by this migration.

