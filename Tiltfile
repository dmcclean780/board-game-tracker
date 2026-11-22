# Local dev only. Infra comes from the compose file shared with `moon run db:up` and e2e.
docker_compose('db/docker-compose.yml')
for name in ['db', 'auth-init', 'auth']:
    dc_resource(name, labels=['infra'])
dc_resource('mailpit', labels=['infra'], links=[link('http://localhost:8025', 'Mailpit')])

# Neither the backend nor Expo (which looks in frontend/) sees the root .env, so pass it to both; fall back to the committed dev defaults.
# .env only overrides .env.example, so a partial .env (e.g. just the compose password) still leaves DATABASE_URL set.
backend_env = {}
for env_file in ['.env.example', '.env']:
    if not os.path.exists(env_file):
        continue
    for line in str(read_file(env_file)).splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            backend_env[key.strip()] = value.strip()
watch_file('.env')

local_resource(
    'backend',
    serve_cmd='cargo run',
    serve_dir='backend',
    serve_env=backend_env,
    deps=['backend/src', 'backend/Cargo.toml', 'backend/Cargo.lock', 'db/migrations'],
    resource_deps=['auth'],
    readiness_probe=probe(http_get=http_get_action(port=3000, path='/health'), period_secs=2, failure_threshold=300),
    links=[link('http://localhost:3000/health', 'API health')],
    labels=['app'],
)

local_resource(
    'frontend-install',
    cmd='npm install',
    dir='frontend',
    deps=['frontend/package-lock.json'],
    labels=['app'],
)

local_resource(
    'frontend',
    serve_cmd='npx expo start --port 8081',
    serve_dir='frontend',
    serve_env=backend_env,
    resource_deps=['frontend-install', 'backend'],
    links=[link('http://localhost:8081', 'App')],
    labels=['app'],
)
