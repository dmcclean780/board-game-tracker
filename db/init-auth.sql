DO $$ BEGIN
  -- GoTrue's migrations grant to a role named postgres; the superuser here is bgt.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'bgt' CREATEROLE;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT CREATE ON DATABASE bgt TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth;
