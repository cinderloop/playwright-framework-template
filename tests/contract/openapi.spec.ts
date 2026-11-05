import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import {
  coveredOperations,
  createSamples,
  labelOf,
  publishReport,
  reviewedSpec,
  runOperation,
  schemaViolation,
  type ContractClients,
} from '@app/contract';
import {
  compareOperation,
  formatDriftReport,
  specFingerprint,
  type OpenApiSpec,
  type OperationResult,
} from '@core/contract';
import { localOnly } from '@core/utils';

// Drift between the spec and the API is reported, not failed: it is a finding about
// Toolshop. Only two things fail, because both need a person: a changed spec, and a
// response that no longer fits the framework's own schemas.
test.describe('OpenAPI contract', { tag: '@contract' }, () => {
  localOnly(config.environment);

  test('the spec fingerprint matches the reviewed one', async ({ api }) => {
    const response = await api.raw.response('GET', '/docs');
    const text = await response.text();
    const { info } = JSON.parse(text) as OpenApiSpec;
    const current = { version: info?.version ?? 'unknown', sha256: specFingerprint(text) };

    expect(
      current,
      'The Toolshop spec changed. Review the drift report, then run npm run check:openapi:update.',
    ).toEqual(reviewedSpec(current));
  });

  test('live responses fit the framework schemas, and drift is reported', async ({
    api,
    adminApi,
    testData,
  }, testInfo) => {
    test.setTimeout(120_000);

    const spec = (await (await api.raw.response('GET', '/docs')).json()) as OpenApiSpec;
    const samples = await createSamples(testData, { anonymous: api, admin: adminApi });
    const clients: ContractClients = {
      anonymous: api,
      customer: samples.customer.api,
      admin: adminApi,
    };

    const results: OperationResult[] = [];
    for (const operation of coveredOperations) {
      await test.step(labelOf(operation), async () => {
        const observed = await runOperation(operation, clients, samples);
        results.push(compareOperation(spec, observed));

        expect
          .soft(schemaViolation(operation, observed.body), `${labelOf(operation)} broke its schema`)
          .toBeUndefined();
      });
    }

    await publishReport(formatDriftReport(spec, results), testInfo);
  });
});
