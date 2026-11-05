/**
 * The seed for a property run: `PROPERTY_SEED` to repeat a failure, otherwise a
 * new one from `fallback`. Kept apart from `checkProperty` so it can be unit tested.
 */
export function resolvePropertySeed(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const seed = Number(value);
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`PROPERTY_SEED must be a whole number, not "${value}".`);
  }
  return seed;
}
