import { test as base } from '@playwright/test';
import { config, type ToolshopConfig } from '@app/config';

export interface ConfigFixtures {
  config: ToolshopConfig;
}

export const configTest = base.extend<object, ConfigFixtures>({
  config: [
    async ({}, use) => {
      await use(config);
    },
    { scope: 'worker' },
  ],
});
