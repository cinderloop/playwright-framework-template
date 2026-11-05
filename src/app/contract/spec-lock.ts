import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/** The reviewed spec: `check:openapi` reports any change from this. */
const LOCK_FILE = resolve(process.cwd(), 'src/app/contract/openapi.lock.json');

const specLockSchema = z.object({ version: z.string(), sha256: z.string() });

export type SpecLock = z.infer<typeof specLockSchema>;

/**
 * The fingerprint to compare with. `npm run check:openapi:update` records the
 * current spec instead, which is how a reviewed change is accepted.
 */
export function reviewedSpec(current: SpecLock): SpecLock {
  if (process.env.UPDATE_OPENAPI) {
    writeFileSync(LOCK_FILE, `${JSON.stringify(current, null, 2)}\n`);
    return current;
  }
  return specLockSchema.parse(JSON.parse(readFileSync(LOCK_FILE, 'utf8')));
}
