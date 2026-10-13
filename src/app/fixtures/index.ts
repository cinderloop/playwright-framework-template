import { mergeTests } from '@playwright/test';
import { test as coreTest } from '@core/fixtures';
import { configTest } from './config.fixture';
import { pagesTest } from './pages.fixture';

/** The `test` every Toolshop spec imports: core fixtures + config + page objects. */
export const test = mergeTests(coreTest, configTest, pagesTest);
export { expect } from '@core/fixtures';
