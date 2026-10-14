/**
 * True inside this repo's test image (see Dockerfile). Visual baselines are
 * generated and compared only there, so rendering is identical everywhere.
 */
export function isRunningInPlaywrightImage(): boolean {
  return process.env.PLAYWRIGHT_DOCKER === '1';
}
