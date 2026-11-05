import { appendFile } from 'node:fs/promises';
import type { TestInfo } from '@playwright/test';

/** Shows the report in the console, the HTML report and, on CI, the job summary. */
export async function publishReport(report: string, testInfo: TestInfo): Promise<void> {
  console.log(report);
  await testInfo.attach('openapi-drift', { body: report, contentType: 'text/markdown' });
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
  }
}
