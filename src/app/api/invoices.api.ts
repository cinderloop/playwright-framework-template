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
  type WithExtraFields,
} from '@app/schemas';

/** Orders. Every endpoint requires a customer (or admin) token. */
export class InvoicesApi extends BaseApiClient {
  createResponse(input: WithExtraFields<InvoiceInput>): Promise<APIResponse> {
    return this.send('POST', '/invoices', { data: input });
  }

  async create(input: WithExtraFields<InvoiceInput>): Promise<CreatedInvoice> {
    return this.parse(await this.createResponse(input), createdInvoiceSchema, 201);
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

  updateResponse(invoiceId: string, input: WithExtraFields<InvoiceInput>): Promise<APIResponse> {
    return this.send('PUT', `/invoices/${invoiceId}`, { data: input });
  }

  patchResponse(
    invoiceId: string,
    input: WithExtraFields<Partial<InvoiceInput>>,
  ): Promise<APIResponse> {
    return this.send('PATCH', `/invoices/${invoiceId}`, { data: input });
  }

  updateStatusResponse(
    invoiceId: string,
    status: InvoiceStatus,
    extraFields: Record<string, unknown> = {},
  ): Promise<APIResponse> {
    return this.send('PUT', `/invoices/${invoiceId}/status`, {
      data: { ...extraFields, status },
    });
  }
}
