import { storageStatePath } from '@core/auth';
import type { Role } from '@app/config';

/** Storage state written by tests/setup/auth.setup.ts for each role. */
export function authFile(role: Role): string {
  return storageStatePath(role);
}
