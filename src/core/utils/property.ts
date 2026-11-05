import { test } from '@playwright/test';
import { assert, type IAsyncProperty } from 'fast-check';
import { resolvePropertySeed } from './property-seed';

const DEFAULT_NUM_RUNS = 20;

export interface PropertyOptions {
  /** Each run costs real API calls, so keep this small. */
  numRuns?: number;
}

/**
 * Runs a property with a bounded number of runs and records its seed as a
 * `property-seed` annotation. To repeat a failure, run that test again with
 * `PROPERTY_SEED=<seed>`; fast-check's error shows the smallest failing input.
 */
export async function checkProperty<TValues>(
  property: IAsyncProperty<TValues>,
  options: PropertyOptions = {},
): Promise<void> {
  const seed = resolvePropertySeed(process.env.PROPERTY_SEED, Date.now() % 2 ** 31);
  test.info().annotations.push({ type: 'property-seed', description: String(seed) });
  await assert(property, { numRuns: options.numRuns ?? DEFAULT_NUM_RUNS, seed });
}
