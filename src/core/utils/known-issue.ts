import { test } from '@playwright/test';

/**
 * Marks the rest of a test as expected to fail because of a recorded defect.
 * Call it directly before the assertion that exposes the defect, never at the
 * top of the test: anything that fails earlier, such as broken setup, must stay
 * a real failure. Once the defect is fixed the test reports an unexpected pass.
 */
export function markKnownIssue(finding: string, description: string): void {
  test.info().annotations.push({ type: 'known-issue', description: `${finding}: ${description}` });
  test.fail();
}
