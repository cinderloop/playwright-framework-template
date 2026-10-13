import { mergeTests } from '@playwright/test';
import { test as coreTest } from '@core/fixtures';
import { apiTest } from './api.fixture';
import { configTest } from './config.fixture';
import { dataTest } from './data.fixture';
import { pagesTest } from './pages.fixture';

/** The `test` every Toolshop spec imports: core + config + API + test data + page objects. */
export const test = mergeTests(coreTest, configTest, apiTest, dataTest, pagesTest);
export { expect } from '@core/fixtures';
