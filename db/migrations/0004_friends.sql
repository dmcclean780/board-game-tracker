-- Eight characters from an alphabet without 0, O, 1, I or L. The bytes come from gen_random_uuid()
-- (cryptographically random, no extension needed), not random().
-- shortcut: byte % 31 is slightly biased and a unique collision is not retried (about 1 in 10^12 per pair); upgrade if Users grow into the millions.
CREATE FUNCTION new_friend_code() RETURNS TEXT LANGUAGE sql VOLATILE AS $$
    SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + get_byte(b, i) % 31, 1), '')
    FROM (SELECT uuid_send(gen_random_uuid()) AS b) t, unnest(ARRAY[0, 1, 2, 3, 4, 5, 10, 11]) AS i
$$;

-- What others type to become this User's Friend. A volatile default is evaluated per existing row too.
ALTER TABLE users ADD COLUMN friend_code TEXT NOT NULL UNIQUE DEFAULT new_friend_code();

-- One row per pair of Friends, the smaller id first, so a friendship is shared and cannot be stored twice.
CREATE TABLE friendships (
    user_a     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_a, user_b),
    CHECK (user_a < user_b)
);
CREATE INDEX friendships_user_b ON friendships (user_b);
