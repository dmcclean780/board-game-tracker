import { defineConfig } from "@playwright/test";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://bgt:bgt@localhost:5432/bgt";
// Dev-only values matching db/docker-compose.yml and .env.example.
const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "dev-only-secret-dev-only-secret-32b";
const AUTH_SERVICE_KEY =
  process.env.AUTH_SERVICE_KEY ??
  "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJpc3MiOiAiYmd0LWRldiIsICJleHAiOiA0MTAyNDQ0ODAwfQ.BFdObu_RTuTOpjfkqdn5numLh2ELz0bMGpJ-b2t_bzo";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:8081" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    { command: "cargo run", cwd: "../backend", url: "http://localhost:3000/health", env: { DATABASE_URL, AUTH_URL: "http://localhost:9999", AUTH_JWT_SECRET, AUTH_SERVICE_KEY }, timeout: 300_000, reuseExistingServer: !process.env.CI },
    { command: "npx expo export -p web && npx expo serve --port 8081", url: "http://localhost:8081", timeout: 300_000, reuseExistingServer: !process.env.CI },
  ],
});
