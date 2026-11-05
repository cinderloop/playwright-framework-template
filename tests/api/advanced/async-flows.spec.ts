import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { localOnly } from '@core/utils';

// The only asynchronous flow in Toolshop. It needs the `worker` service in
// docker-compose.yml, which plays the part of upstream's cron.
test.describe('Invoice PDF generation', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('a new invoice reaches a downloadable PDF', async ({ testData }) => {
    const customer = await testData.customer();
    const { invoice } = await testData.order(customer);

    await testData.generatedPdf(customer, invoice.invoice_number);

    const response = await customer.api.invoices.pdfResponse(invoice.invoice_number);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/pdf');
    expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('an unknown invoice has no PDF', async ({ testData }) => {
    const { api } = await testData.customer();

    const response = await api.invoices.pdfResponse('INV-0000000000');

    expect(response.status()).toBe(404);
  });
});
