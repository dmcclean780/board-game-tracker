-- Placeholder schema proving the migration pipeline; real tables follow the business-rules session.
CREATE TABLE players (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
