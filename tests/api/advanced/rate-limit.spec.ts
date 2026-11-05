import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { errorMessageSchema } from '@app/schemas';
import { localOnly, markKnownIssue } from '@core/utils';

const REPORT = 'total-sales-of-years';

// Only /reports is rate limited (docs/api-recon.md). The limit is per user, so a
// new customer gets their own allowance and cannot disturb the matrix's admin
// rows. Requests count before the role check, so a customer's 403s use it up.
test.describe('Rate limiting', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('reports answer 429 past the limit', async ({ testData }) => {
    const { api } = await testData.customer();

    const first = await api.reports.getResponse(REPORT);
    const remaining = Number(first.headers()['x-ratelimit-remaining']);
    expect(first.headers()['x-ratelimit-limit']).toBe('60');
    expect(remaining).toBe(59);

    // Exactly the allowance and one more: enough to prove it, without hammering.
    for (let call = 0; call < remaining; call += 1) {
      await api.reports.getResponse(REPORT);
    }
    const limited = await api.reports.getResponse(REPORT);

    expect(limited.status()).toBe(429);
    await expect(limited).toMatchSchema(errorMessageSchema);

    markKnownIssue('F-16', 'the 429 response has no Retry-After header');
    expect(limited.headers()['retry-after']).toBeDefined();
  });
});
