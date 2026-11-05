import { createHash } from 'node:crypto';
import { compareToSchema, type FieldDrift, type JsonSchema } from './compare-schema';

interface ResponseObject {
  $ref?: string;
  content?: Record<string, { schema?: JsonSchema }>;
}

type Operation = { responses?: Record<string, ResponseObject> } | undefined;

export interface OpenApiSpec {
  info?: { title?: string; version?: string };
  paths: Record<string, Record<string, Operation>>;
}

export interface ObservedResponse {
  method: string;
  /** The path as the spec writes it, e.g. `/products/{productId}`. */
  path: string;
  status: number;
  body: unknown;
}

export type DriftKind = FieldDrift['kind'] | 'undocumented-status' | 'undocumented-operation';

export interface Drift {
  kind: DriftKind;
  path: string;
  detail: string;
}

export interface OperationResult {
  operation: string;
  status: number;
  drift: Drift[];
}

/** Identifies the exact spec text, so a changed spec cannot go unnoticed. */
export function specFingerprint(specText: string): string {
  return createHash('sha256').update(specText).digest('hex');
}

/** Replaces `{name}` placeholders in a spec path with real values. */
export function fillPath(path: string, values: Readonly<Record<string, string>>): string {
  return path.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`No value for ${placeholder} in ${path}.`);
    return value;
  });
}

/** Follows a local reference such as `#/components/schemas/Product`. */
function lookUp(spec: OpenApiSpec, ref: string): unknown {
  let current: unknown = spec;
  for (const part of ref.replace(/^#\//, '').split('/')) {
    const key = part.replaceAll('~1', '/').replaceAll('~0', '~');
    if (typeof current !== 'object' || current === null || !(key in current)) {
      throw new Error(`Cannot resolve ${ref} in the spec.`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Compares one real response with what the spec documents for that operation. */
export function compareOperation(spec: OpenApiSpec, observed: ObservedResponse): OperationResult {
  const { method, path, status, body } = observed;
  const operation = `${method} ${path}`;
  const summary = { operation, status };

  const responses = spec.paths[path]?.[method.toLowerCase()]?.responses;
  if (!responses) {
    const detail = 'the operation is not in the spec';
    return { ...summary, drift: [{ kind: 'undocumented-operation', path: '-', detail }] };
  }

  const documented = responses[String(status)] ?? responses.default;
  if (!documented) {
    const listed = Object.keys(responses).join(', ');
    const detail = `${String(status)} is not documented (documented: ${listed})`;
    return { ...summary, drift: [{ kind: 'undocumented-status', path: '-', detail }] };
  }

  const response = documented.$ref ? (lookUp(spec, documented.$ref) as ResponseObject) : documented;
  const schema = response.content?.['application/json']?.schema;
  if (!schema || body === undefined) return { ...summary, drift: [] };

  return {
    ...summary,
    drift: compareToSchema(body, schema, (ref) => lookUp(spec, ref) as JsonSchema),
  };
}

function escapeCell(text: string): string {
  return text.replaceAll('|', String.raw`\|`);
}

/** A Markdown report for the console, the job summary and the test report. */
export function formatDriftReport(spec: OpenApiSpec, results: readonly OperationResult[]): string {
  const drifting = results.filter((result) => result.drift.length > 0);
  const version = spec.info?.version ?? 'unknown';
  const lines = [
    `# OpenAPI drift report`,
    '',
    `Spec version ${version}. ${String(results.length)} responses checked, ` +
      `${String(drifting.length)} with drift.`,
  ];

  if (drifting.length > 0) {
    lines.push(
      '',
      '| Operation | Status | Kind | Field | Detail |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const { operation, status, drift } of drifting) {
      for (const { kind, path, detail } of drift) {
        const cells = [operation, String(status), kind, path, detail].map(escapeCell);
        lines.push(`| ${cells.join(' | ')} |`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}
