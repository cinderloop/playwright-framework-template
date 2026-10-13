import { randomUUID } from 'node:crypto';

/** Short collision-resistant suffix for test data that must not clash across parallel workers. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}
