import { expect as baseExpect } from '@playwright/test';
import { toMatchSchema } from './to-match-schema';

/** Playwright's `expect` plus the framework's custom matchers. */
export const expect = baseExpect.extend({ toMatchSchema });
