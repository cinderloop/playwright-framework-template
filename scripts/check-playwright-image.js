// Fails when the Playwright Docker image in the Dockerfile does not match the
// installed @playwright/test version. Visual baselines are only valid for the
// exact browser builds of that image, so the two must move together.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
/** @type {{ version: string }} */
const { version } = require('@playwright/test/package.json');
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const imageTag = /mcr\.microsoft\.com\/playwright:v([\d.]+)-/.exec(dockerfile)?.[1];

if (imageTag !== version) {
  console.error(
    `Dockerfile uses mcr.microsoft.com/playwright:v${imageTag ?? '?'} but @playwright/test is ${version}. ` +
      'Update the Dockerfile tag, then regenerate visual baselines with `npm run test:visual:update`.',
  );
  process.exit(1);
}
console.log(`Playwright image matches @playwright/test ${version}.`);
