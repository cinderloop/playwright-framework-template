import { expect as baseExpect } from '@playwright/test';
import { toMatchSchema } from './to-match-schema';
import { toNotExposeFields } from './to-not-expose-fields';

/** Playwright's `expect` plus the framework's custom matchers. */
export const expect = baseExpect.extend({ toMatchSchema, toNotExposeFields });
