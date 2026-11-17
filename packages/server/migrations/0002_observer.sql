-- M3 / A-19: shareable observer links — no-login, read-only access via unguessable token.
ALTER TABLE games ADD COLUMN observer_token text UNIQUE;
