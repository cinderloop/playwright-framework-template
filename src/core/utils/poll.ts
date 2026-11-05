import { expect, test } from '@playwright/test';
import { defaultRedactor } from '../api/redact';

export interface PollOptions {
  /** Reads naturally after "waiting for", e.g. `the invoice PDF to be generated`. */
  description: string;
  /** Total time allowed, in milliseconds. */
  timeout?: number;
  /** Delays between attempts, in milliseconds; the last one repeats. */
  intervals?: number[];
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_INTERVALS = [250, 500, 1_000, 2_000];

/**
 * Calls `probe` until `until` accepts its result, then returns that result.
 * For genuinely asynchronous flows only. On timeout the error names what was
 * awaited and the last value seen; an error thrown by `probe` fails at once.
 */
export async function pollUntil<TValue>(
  probe: () => Promise<TValue>,
  until: (value: TValue) => boolean,
  options: PollOptions,
): Promise<TValue> {
  const { description, timeout = DEFAULT_TIMEOUT, intervals = DEFAULT_INTERVALS } = options;

  return test.step(
    `poll: ${description}`,
    async () => {
      const state: { attempts: number; last?: TValue; thrown?: { error: unknown } } = {
        attempts: 0,
      };
      const attempt = async (): Promise<boolean> => {
        state.attempts += 1;
        try {
          state.last = await probe();
          return until(state.last);
        } catch (error) {
          state.thrown = { error };
          throw error;
        }
      };

      try {
        await expect.poll(attempt, { timeout, intervals }).toBe(true);
      } catch (error) {
        // An error from the probe or the check has not timed out, so keep it as it is.
        if (state.thrown) throw state.thrown.error;
        const seen = JSON.stringify(defaultRedactor.body(state.last));
        throw new Error(
          `Timed out after ${String(timeout)}ms and ${String(state.attempts)} attempt(s) waiting for ${description}. Last value: ${seen}`,
          { cause: error },
        );
      }
      return state.last as TValue;
    },
    { box: true },
  );
}
