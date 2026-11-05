import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';

export const reportNames = [
  'total-sales-per-country',
  'top10-purchased-products',
  'top10-best-selling-categories',
  'total-sales-of-years',
  'average-sales-per-month',
  'average-sales-per-week',
  'customers-by-country',
] as const;

export type ReportName = (typeof reportNames)[number];

/** Sales reports. Admin only, and limited to 60 requests a minute per user. */
export class ReportsApi extends BaseApiClient {
  getResponse(report: ReportName): Promise<APIResponse> {
    return this.send('GET', `/reports/${report}`);
  }
}
