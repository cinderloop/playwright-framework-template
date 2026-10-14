/**
 * Defines a factory for test data. `build` returns fresh default values on
 * every call (typically from faker); callers override only what a test cares about.
 *
 * @example
 * const buildBrand = defineFactory(() => ({ name: faker.company.name(), slug: ... }));
 * buildBrand({ name: 'Acme' });
 */
export function defineFactory<T extends object>(build: () => T): (overrides?: Partial<T>) => T {
  return (overrides = {}) => ({ ...build(), ...overrides });
}
