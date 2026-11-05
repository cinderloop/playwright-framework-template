import type { APIResponse } from '@playwright/test';

/** One acceptable status, or several where more than one answer is correct. */
export type StatusExpectation = number | readonly number[];

/**
 * A row asserts the correct behaviour even when the application gets it wrong.
 * This records the defect, so the suite stays green while it exists and goes
 * red once it changes.
 */
export interface KnownIssue {
  /** Reference into the findings document, e.g. `F-03`. */
  finding: string;
  /** What is wrong, for the report annotation. */
  description: string;
  /** The wrong status seen today. Any other wrong status is a real failure. */
  observedStatus: number;
}

export interface DetailedExpectation<TResource> {
  status: StatusExpectation;
  /** Replaces the status in the test title when the status says little, as in GraphQL. */
  label?: string;
  /** Checks a status cannot prove, e.g. that a refused write changed nothing. */
  verify?: (outcome: { resource: TResource; response: APIResponse }) => Promise<void>;
  knownIssue?: KnownIssue;
}

export type Expectation<TResource> = StatusExpectation | DetailedExpectation<TResource>;

/** How a test obtains the client that acts as a given actor. */
export interface AuthorizationContext<TActor extends string, TClient> {
  actor(name: TActor): Promise<TClient>;
}

/** One operation, and what each actor should get from it. */
export interface MatrixEntry<
  TActor extends string,
  TClient,
  TContext extends AuthorizationContext<TActor, TClient>,
  TResource,
> {
  /** The operation, e.g. `GET /invoices/{id}`. */
  name: string;
  /** Creates the resource and its owner. Runs once per row, so rows stay independent. */
  arrange: (context: TContext) => Promise<TResource>;
  request: (client: TClient, resource: TResource) => Promise<APIResponse>;
  expectations: Partial<Record<TActor, Expectation<TResource>>>;
}

export interface RowOutcome {
  status: number;
  verify: () => Promise<void>;
}

/** One generated test. The resource type is sealed inside `perform`. */
export interface AuthorizationRow<
  TActor extends string,
  TClient,
  TContext extends AuthorizationContext<TActor, TClient>,
> {
  title: string;
  actor: TActor;
  statuses: readonly number[];
  knownIssue?: KnownIssue;
  /** Arranges and sends the request; assertions stay with the caller. */
  perform: (context: TContext) => Promise<RowOutcome>;
}

function isDetailed<TResource>(
  expectation: Expectation<TResource>,
): expectation is DetailedExpectation<TResource> {
  return typeof expectation === 'object' && 'status' in expectation;
}

function toStatuses(expectation: StatusExpectation): readonly number[] {
  return typeof expectation === 'number' ? [expectation] : expectation;
}

/** Turns one entry into one row per actor. */
export function expandEntry<
  TActor extends string,
  TClient,
  TContext extends AuthorizationContext<TActor, TClient>,
  TResource,
>(
  entry: MatrixEntry<TActor, TClient, TContext, TResource>,
): AuthorizationRow<TActor, TClient, TContext>[] {
  const expectations = Object.entries(entry.expectations) as [TActor, Expectation<TResource>][];

  return expectations.map(([actor, expectation]) => {
    const detail: DetailedExpectation<TResource> = isDetailed(expectation)
      ? expectation
      : { status: expectation };
    const { label, verify, knownIssue } = detail;
    const statuses = toStatuses(detail.status);
    const title = `${entry.name} as ${actor} → ${label ?? statuses.join('/')}`;

    if (statuses.length === 0) {
      throw new Error(`${title}: no acceptable status.`);
    }
    if (knownIssue && statuses.includes(knownIssue.observedStatus) && !verify) {
      throw new Error(`${title}: the known issue's status is accepted and nothing else can fail.`);
    }

    return {
      title,
      actor,
      statuses,
      ...(knownIssue ? { knownIssue } : {}),
      perform: async (context) => {
        const resource = await entry.arrange(context);
        const client = await context.actor(actor);
        const response = await entry.request(client, resource);
        return {
          status: response.status(),
          verify: async () => {
            await verify?.({ resource, response });
          },
        };
      },
    };
  });
}

/** Combines expanded entries, rejecting duplicates: Playwright needs unique titles. */
export function buildMatrix<
  TActor extends string,
  TClient,
  TContext extends AuthorizationContext<TActor, TClient>,
>(
  ...entries: AuthorizationRow<TActor, TClient, TContext>[][]
): AuthorizationRow<TActor, TClient, TContext>[] {
  const rows = entries.flat();
  const seen = new Set<string>();
  for (const { title } of rows) {
    if (seen.has(title)) throw new Error(`Duplicate authorization row: ${title}`);
    seen.add(title);
  }
  return rows;
}

/**
 * Whether a failure of this row is the recorded defect. A status that is neither
 * acceptable nor the one recorded means something else broke, so it must not be
 * excused. An acceptable status counts, so a fixed defect surfaces as an
 * unexpected pass.
 */
export function isExplainedByKnownIssue(
  row: Pick<AuthorizationRow<string, unknown, never>, 'statuses' | 'knownIssue'>,
  status: number,
): boolean {
  if (!row.knownIssue) return false;
  return status === row.knownIssue.observedStatus || row.statuses.includes(status);
}
