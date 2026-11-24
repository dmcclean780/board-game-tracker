-- A Session is one sitting of a Game. `result` is checked by the Game's Rust crate, so new Games need no migration.
-- The placeholder players table is replaced by player names on the Session.
DROP TABLE players;
CREATE TABLE sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    game             TEXT NOT NULL,
    played_on        DATE NOT NULL,
    notes            TEXT,
    duration_minutes INT CHECK (duration_minutes > 0),
    players          TEXT[] NOT NULL CHECK (cardinality(players) > 0),
    result           JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_owner_played_on ON sessions (owner_id, played_on DESC);
