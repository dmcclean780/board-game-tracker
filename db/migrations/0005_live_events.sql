-- Live updates: the database announces changes on the `bgt_events` channel and every backend instance
-- relays them to the sockets of the Users concerned. Triggers, not route code, so every writer is covered
-- (routes, the purge's cascade, manual SQL). The payload names the User and a kind, never data.
-- shortcut: NOTIFY is lost while a backend's listener is reconnecting; clients refetch on reconnect, so upgrade only if that gap matters.
CREATE FUNCTION notify_user(uid UUID, kind TEXT) RETURNS VOID LANGUAGE sql AS $$
    SELECT pg_notify('bgt_events', json_build_object('user', uid, 'type', kind)::text)
$$;

-- A friendship started or ended: both Users' lists changed.
CREATE FUNCTION friendships_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    a UUID;
    b UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        a := OLD.user_a;
        b := OLD.user_b;
    ELSE
        a := NEW.user_a;
        b := NEW.user_b;
    END IF;
    PERFORM notify_user(a, 'friends');
    PERFORM notify_user(b, 'friends');
    RETURN NULL;
END
$$;

CREATE TRIGGER friendships_changed AFTER INSERT OR DELETE ON friendships
    FOR EACH ROW EXECUTE FUNCTION friendships_changed();

-- A User's own details changed: their other tabs refresh `me`; a new name also reaches every Friend's list.
CREATE FUNCTION users_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.display_name IS DISTINCT FROM OLD.display_name THEN
        PERFORM notify_user(CASE WHEN f.user_a = NEW.id THEN f.user_b ELSE f.user_a END, 'friends')
        FROM friendships f WHERE NEW.id IN (f.user_a, f.user_b);
    END IF;
    PERFORM notify_user(NEW.id, 'me');
    RETURN NULL;
END
$$;

CREATE TRIGGER users_changed AFTER UPDATE OF display_name, friend_code ON users
    FOR EACH ROW EXECUTE FUNCTION users_changed();
