import { defineConfig } from 'vitest/config';

// Pure functions in src/core only. The files live beside the code rather than in
// tests/, which Playwright owns, and must not import @playwright/test at runtime:
// its `expect` cannot share a process with Vitest's. Import the module under test
// directly, because the barrels pull Playwright in.
export default defineConfig({
  test: {
    include: ['src/core/**/*.unit.test.ts'],
    environment: 'node',
  },
});
