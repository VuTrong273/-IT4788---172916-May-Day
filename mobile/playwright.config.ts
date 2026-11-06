import { defineConfig, devices } from '@playwright/test';

const port = process.env.EXPO_WEB_PORT || '8081';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
  ...(useExternalServer
    ? {}
    : {
        webServer: {
          command: `npm run web -- --port ${port}`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            EXPO_NO_TELEMETRY: '1',
          },
        },
      }),
});
