import { defineConfig, devices } from '@playwright/test';
import { config } from '@app/config';

const isCI = !!process.env.CI;

// Browser projects run only after the API/UI health check and the per-role
// login have succeeded. API tests run once, without a browser.
const setupDependencies = ['setup'];
// API, accessibility and visual tests have dedicated projects below.
const browserTests = {
  testIgnore: ['**/tests/api/**', '**/tests/a11y/**', '**/tests/visual/**'],
  dependencies: setupDependencies,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 2 } : {}),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // CI writes a blob report as well, so sharded runs can be merged into one HTML report.
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['blob']]
    : [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: config.baseUrl,
    // Toolshop marks elements with `data-test`, not the default `data-testid`.
    testIdAttribute: 'data-test',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'health', testMatch: /health\.setup\.ts/ },
    { name: 'setup', testMatch: /auth\.setup\.ts/, dependencies: ['health'] },
    { name: 'api', testDir: './tests/api', dependencies: ['health'] },
    {
      // axe results and ARIA trees are checked once, on desktop Chromium.
      name: 'a11y',
      testDir: './tests/a11y',
      use: { ...devices['Desktop Chrome'] },
      dependencies: setupDependencies,
    },
    {
      // Baselines are Linux/Chromium only (generated in the Playwright Docker
      // image), so the platform is left out of the snapshot path.
      name: 'visual',
      testDir: './tests/visual',
      use: { ...devices['Desktop Chrome'] },
      snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
      expect: {
        toHaveScreenshot: {
          stylePath: './tests/visual/screenshot.css',
          maxDiffPixelRatio: 0.01,
        },
      },
      dependencies: setupDependencies,
    },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      ...browserTests,
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      ...browserTests,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      ...browserTests,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      ...browserTests,
    },
  ],
});
