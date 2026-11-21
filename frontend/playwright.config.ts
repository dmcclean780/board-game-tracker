import { defineConfig } from "@playwright/test";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://bgt:bgt@localhost:5432/bgt";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://localhost:8081" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: [
    { command: "cargo run", cwd: "../backend", url: "http://localhost:3000/health", env: { DATABASE_URL }, timeout: 300_000, reuseExistingServer: !process.env.CI },
    { command: "npx expo export -p web && npx expo serve --port 8081", url: "http://localhost:8081", timeout: 300_000, reuseExistingServer: !process.env.CI },
  ],
});
