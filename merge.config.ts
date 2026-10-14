// Used by `playwright merge-reports` in the nightly workflow. Blob reports
// come from native runners and from the Playwright Docker image (visual
// tests), whose test directories differ; pointing testDir at the repo's tests
// lets their results be merged into one report with correct paths.
export default {
  testDir: './tests',
};
