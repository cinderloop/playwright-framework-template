import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import {
  createdInvoiceSchema,
  invoicePageSchema,
  invoiceSchema,
  type CreatedInvoice,
  type Invoice,
  type InvoiceInput,
  type InvoiceStatus,
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

  searchResponse(term: string): Promise<APIResponse> {
    return this.send('GET', '/invoices/search', { params: { q: term } });
  }

  getResponse(invoiceId: string): Promise<APIResponse> {
    return this.send('GET', `/invoices/${invoiceId}`);
  }

  async get(invoiceId: string): Promise<Invoice> {
    return this.parse(await this.getResponse(invoiceId), invoiceSchema);
  }

  updateResponse(invoiceId: string, input: InvoiceInput): Promise<APIResponse> {
    return this.send('PUT', `/invoices/${invoiceId}`, { data: input });
  }

  patchResponse(invoiceId: string, input: Partial<InvoiceInput>): Promise<APIResponse> {
    return this.send('PATCH', `/invoices/${invoiceId}`, { data: input });
  }

  updateStatusResponse(invoiceId: string, status: InvoiceStatus): Promise<APIResponse> {
    return this.send('PUT', `/invoices/${invoiceId}/status`, { data: { status } });
  }
}
