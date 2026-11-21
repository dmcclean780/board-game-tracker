import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: { command: "npx expo start --web --port 8081", url: "http://localhost:8081", reuseExistingServer: true, timeout: 120_000 },
  use: { baseURL: "http://localhost:8081" },
});
