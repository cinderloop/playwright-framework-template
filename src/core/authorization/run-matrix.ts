import { expect, test as baseTest, type TestType } from '@playwright/test';
import {
  isAssertionFailure,
  type AuthorizationContext,
  type AuthorizationRow,
  type RowOutcome,
} from './matrix';

/**
 * Applies a row's expectations. A known issue may only excuse the defect it
 * records, so `test.fail()` is decided here, after the request has worked:
 *
 * - The recorded wrong status is the defect. Any other wrong status is a new fault.
 * - A failed assertion in `verify` is the defect. Anything else thrown there, such
 *   as an unparseable body, is a new fault.
 * - If everything passes, the defect is gone, and marking the test as an expected
 *   failure makes that show up as an unexpected pass.
 */
async function assertRow<TActor extends string, TClient, TContext>(
  row: AuthorizationRow<TActor, TClient, TContext & AuthorizationContext<TActor, TClient>>,
  { status, verify }: RowOutcome,
): Promise<void> {
  const { knownIssue, statuses, title } = row;

  if (!statuses.includes(status)) {
    baseTest.fail(status === knownIssue?.observedStatus, knownIssue?.description);
    expect(statuses, `${title}: the API returned ${String(status)}`).toContain(status);
  }

  try {
    await verify();
  } catch (error) {
    baseTest.fail(knownIssue !== undefined && isAssertionFailure(error), knownIssue?.description);
    throw error;
  }
  baseTest.fail(knownIssue !== undefined, knownIssue?.description);
}

/**
 * Generates one test per row. `test` must provide an `authorizationContext`
 * fixture, because Playwright reads fixture names from the test function's
 * source and they cannot be passed in.
 */
export function runAuthorizationMatrix<
  TActor extends string,
  TClient,
  TContext extends AuthorizationContext<TActor, TClient>,
  TArgs extends { authorizationContext: TContext },
  TWorkerArgs extends object,
>(
  test: TestType<TArgs, TWorkerArgs>,
  rows: readonly AuthorizationRow<TActor, TClient, TContext>[],
): void {
  for (const row of rows) {
    const { knownIssue } = row;
    const details = knownIssue
      ? {
          annotation: {
            type: 'known-issue',
            description: `${knownIssue.finding}: ${knownIssue.description}`,
          },
        }
      : {};

    test(row.title, details, async ({ authorizationContext }) => {
      await assertRow(row, await row.perform(authorizationContext));
    });
  }
}
