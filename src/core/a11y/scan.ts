import { AxeBuilder } from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
export type AxeViolation = AxeResults['violations'][number];

/** WCAG 2.1 level A and AA, the usual compliance target. */
export const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A rule that is known to fail on a page, with the reason it is tolerated for now. */
export interface KnownViolation {
  rule: string;
  reason: string;
}

export interface A11yScanOptions {
  tags?: string[];
  /** CSS selectors to leave out of the scan, e.g. third-party widgets. */
  exclude?: string[];
  /** Known violations that do not fail the scan. */
  baseline?: readonly KnownViolation[];
}

export interface A11yScanResult {
  /** Violations not covered by the baseline: these fail the test. */
  unexpected: AxeViolation[];
  /** Baseline rules that no longer fail: the baseline can be trimmed. */
  stale: KnownViolation[];
}

/**
 * Runs axe on the current page and splits the result against a baseline of
 * known rule failures. The full axe output is attached to the test report.
 */
export async function scanAccessibility(
  page: Page,
  testInfo: TestInfo,
  { tags = WCAG_21_AA, exclude = [], baseline = [] }: A11yScanOptions = {},
): Promise<A11yScanResult> {
  let builder = new AxeBuilder({ page }).withTags(tags);
  for (const selector of exclude) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();
  await testInfo.attach('axe-results', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const known = new Set(baseline.map(({ rule }) => rule));
  const failing = new Set(results.violations.map(({ id }) => id));
  return {
    unexpected: results.violations.filter(({ id }) => !known.has(id)),
    stale: baseline.filter(({ rule }) => !failing.has(rule)),
  };
}

/** One line per violation, for readable assertion messages. */
export function summarizeViolations(violations: AxeViolation[]): string[] {
  return violations.map(
    ({ id, impact, help, nodes }) =>
      `${id} (${impact ?? 'unknown'}): ${help} [${nodes.map(({ target }) => target.join(' ')).join(', ')}]`,
  );
}
