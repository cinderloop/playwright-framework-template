import { expect, test as baseTest, type TestType } from '@playwright/test';
import {
  isExplainedByKnownIssue,
  type AuthorizationContext,
  type AuthorizationRow,
} from './matrix';

/**
 * Generates one test per row. `test` must provide an `authorizationContext`
 * fixture, because Playwright reads fixture names from the test function's
 * source and they cannot be passed in.
 *
 * Known issues are marked as expected failures only after the arrange step and
 * the request have worked, and only for the recorded status. Declaring
 * `test.fail()` up front would turn a broken arrange step into a green test.
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
      const { status, verify } = await row.perform(authorizationContext);

      baseTest.fail(isExplainedByKnownIssue(row, status), knownIssue?.description);
      expect(row.statuses, `${row.title}: the API returned ${String(status)}`).toContain(status);
      await verify();
    });
  }
}
