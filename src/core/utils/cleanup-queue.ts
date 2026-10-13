import { test } from '@playwright/test';

export type CleanupTask = () => Promise<void>;

/**
 * Collects teardown work during a test and runs it last-in, first-out. Every
 * task runs even when an earlier one fails; failures are reported together.
 */
export class CleanupQueue {
  private readonly tasks: { description: string; task: CleanupTask }[] = [];

  add(description: string, task: CleanupTask): void {
    this.tasks.push({ description, task });
  }

  async run(): Promise<void> {
    const failures: unknown[] = [];
    for (const { description, task } of this.tasks.splice(0).reverse()) {
      await test.step(`cleanup: ${description}`, task, { box: true }).catch((error: unknown) => {
        failures.push(error);
      });
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `${String(failures.length)} cleanup task(s) failed`);
    }
  }
}
