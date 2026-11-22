-- A User is a person with an account; id is the auth provider's subject.
CREATE TABLE users (
    id                    UUID PRIMARY KEY,
    email                 TEXT NOT NULL,
    display_name          TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deletion_requested_at TIMESTAMPTZ
);
