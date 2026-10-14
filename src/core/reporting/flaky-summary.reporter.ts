import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import type { FullConfig, Reporter, Suite, TestCase } from '@playwright/test/reporter';

export interface FlakySummaryOptions {
  /** Tag of tests that are known to be unstable and kept out of blocking runs. */
  quarantineTag?: string;
  /** Also write the summary as JSON to this path, e.g. to keep it as an artifact. */
  outputFile?: string;
}

interface Entry {
  project: string;
  title: string;
  location: string;
  outcome: ReturnType<TestCase['outcome']>;
  retries: number;
}

/**
 * Lists flaky tests (failed, then passed on retry) and quarantined tests after
 * a run: on the console, in the GitHub Actions job summary when
 * GITHUB_STEP_SUMMARY is set, and optionally as JSON. It never changes the
 * run's result; it makes instability visible so it can be tracked.
 */
export default class FlakySummaryReporter implements Reporter {
  private suite: Suite | undefined;
  private readonly quarantineTag: string;
  private readonly outputFile: string | undefined;

  constructor(options: FlakySummaryOptions = {}) {
    this.quarantineTag = options.quarantineTag ?? '@quarantine';
    this.outputFile = options.outputFile;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  onEnd(): void {
    const tests = this.suite?.allTests() ?? [];
    const flaky = tests.filter((test) => test.outcome() === 'flaky').map(toEntry);
    const quarantined = tests.filter((test) => test.tags.includes(this.quarantineTag)).map(toEntry);

    if (this.outputFile) {
      mkdirSync(dirname(this.outputFile), { recursive: true });
      writeFileSync(this.outputFile, JSON.stringify({ flaky, quarantined }, null, 2));
    }
    if (flaky.length > 0) {
      console.log(`\n${String(flaky.length)} flaky test(s):`);
      for (const entry of flaky)
        console.log(`  [${entry.project}] ${entry.title} (${entry.location})`);
    }

    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile && (flaky.length > 0 || quarantined.length > 0)) {
      appendFileSync(summaryFile, toMarkdown(flaky, quarantined, this.quarantineTag));
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

const OUTCOME_LABELS: Record<Entry['outcome'], string> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
};

function toEntry(test: TestCase): Entry {
  return {
    project: test.parent.project()?.name ?? '',
    title: test.titlePath().slice(3).join(' › '),
    location: `${relative(process.cwd(), test.location.file)}:${String(test.location.line)}`,
    outcome: test.outcome(),
    retries: Math.max(test.results.length - 1, 0),
  };
}

function toMarkdown(flaky: Entry[], quarantined: Entry[], tag: string): string {
  const table = (entries: Entry[], extra: (entry: Entry) => string) =>
    [
      '| Project | Test | Location | Result |',
      '| --- | --- | --- | --- |',
      ...entries.map((e) => `| ${e.project} | ${e.title} | \`${e.location}\` | ${extra(e)} |`),
    ].join('\n');

  const sections = ['## Test stability'];
  if (flaky.length > 0) {
    sections.push(
      `### Flaky (${String(flaky.length)})\n\nFailed, then passed on retry.\n\n` +
        table(
          flaky,
          (e) => `passed after ${String(e.retries)} retr${e.retries === 1 ? 'y' : 'ies'}`,
        ),
    );
  }
  if (quarantined.length > 0) {
    sections.push(
      `### Quarantined \`${tag}\` (${String(quarantined.length)})\n\n` +
        table(quarantined, (e) => OUTCOME_LABELS[e.outcome]),
    );
  }
  return `${sections.join('\n\n')}\n`;
}
