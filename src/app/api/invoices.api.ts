import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import {
  createdInvoiceSchema,
  invoicePageSchema,
  invoiceSchema,
  type CreatedInvoice,
  type Invoice,
  type InvoiceInput,
} from '@app/schemas';

/** Orders. Every endpoint requires a customer (or admin) token. */
export class InvoicesApi extends BaseApiClient {
  async create(input: InvoiceInput): Promise<CreatedInvoice> {
    return this.parse(
      await this.send('POST', '/invoices', { data: input }),
      createdInvoiceSchema,
      201,
    );
  }

  listResponse(page = 1): Promise<APIResponse> {
    return this.send('GET', '/invoices', { params: { page } });
  }

  async list(page = 1) {
    return this.parse(await this.listResponse(page), invoicePageSchema);
  }

  async get(invoiceId: string): Promise<Invoice> {
    return this.parse(await this.send('GET', `/invoices/${invoiceId}`), invoiceSchema);
  }
}
