import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Values every target environment must provide. Application layers extend this
 * schema with their own variables (credentials, feature flags, ...).
 */
export const baseEnvSchema = z.object({
  TEST_ENV: z.string().min(1),
  BASE_URL: z.url(),
  API_URL: z.url(),
});

/** Per-environment defaults, keyed by `TEST_ENV` (e.g. `local`, `staging`). */
export type EnvironmentPresets = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface LoadConfigOptions<TSchema extends z.ZodType> {
  schema: TSchema;
  environments: EnvironmentPresets;
  defaultEnvironment: string;
  /** Defaults to `process.env`; injectable for tests. */
  env?: NodeJS.ProcessEnv;
  /** `.env` file to load into `env` before validating. Ignored when absent. */
  envFile?: string | false;
}

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

/**
 * Resolves configuration for the environment named by `TEST_ENV` and validates
 * it against `schema`. Precedence (highest first): real environment variables,
 * `.env` file, environment preset. Throws `ConfigError` on any invalid or
 * missing value, so a misconfigured run fails before a browser starts.
 */
export function loadConfig<TSchema extends z.ZodType>(
  options: LoadConfigOptions<TSchema>,
): Readonly<z.output<TSchema>> {
  const { schema, environments, defaultEnvironment, env = process.env } = options;
  const envFile = options.envFile ?? resolve(process.cwd(), '.env');

  // process.loadEnvFile never overrides variables that are already set.
  if (envFile && env === process.env && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }

  const testEnv = env.TEST_ENV ?? defaultEnvironment;
  const preset = environments[testEnv];
  if (!preset) {
    throw new ConfigError(
      `Unknown TEST_ENV "${testEnv}". Expected one of: ${Object.keys(environments).join(', ')}.`,
    );
  }

  const result = schema.safeParse({ ...preset, ...definedOnly(env), TEST_ENV: testEnv });
  if (!result.success) {
    throw new ConfigError(
      `Invalid configuration for TEST_ENV "${testEnv}":\n${z.prettifyError(result.error)}\n` +
        'See .env.example for every supported variable.',
    );
  }
  return Object.freeze(result.data);
}

function definedOnly(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
