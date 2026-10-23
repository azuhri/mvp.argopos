import { defineConfig, devices } from "@playwright/test";

// Transport-only regression: the spec owns disposable HTTP servers on port 0.
// No Vite server, company API, database, or payment provider is required.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "payment-cookie-ownership.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  outputDir: "test-results/payment-cookie-ownership",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
