import { z } from 'zod';
import { fillPath, type ObservedResponse } from '@core/contract';
import type { ContractClients, ContractSamples, CoveredOperation } from './operations';

const createdSchema = z.object({ id: z.string() });

function parseBody(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function labelOf({ method, path, scenario }: CoveredOperation): string {
  return `${method} ${path}${scenario ? ` (${scenario})` : ''}`;
}

/** Why a body breaks the operation's framework schema, or `undefined` if it fits. */
export function schemaViolation(operation: CoveredOperation, body: unknown): string | undefined {
  const parsed = operation.schema?.safeParse(body);
  return parsed?.error ? z.prettifyError(parsed.error) : undefined;
}

/** Sends the request and removes whatever it created. */
export async function runOperation(
  operation: CoveredOperation,
  clients: ContractClients,
  samples: ContractSamples,
): Promise<ObservedResponse> {
  const { method, path, as = 'anonymous', values, query, data, undo } = operation;
  const payload = data?.(samples);

  const response = await clients[as].raw.response(method, fillPath(path, values?.(samples) ?? {}), {
    ...(query ? { params: query } : {}),
    ...(payload === undefined ? {} : { data: payload }),
  });
  const body = parseBody(await response.text());

  const created = createdSchema.safeParse(body);
  if (undo && created.success) await undo(clients, created.data.id);

  return { method, path, status: response.status(), body };
}
