/** Replaces every sensitive value. */
export const REDACTED = '[REDACTED]';

/**
 * Matched against normalised names (lower case, separators removed) as
 * substrings, for headers, query parameters and body keys alike. Matching
 * loosely masks a few harmless fields such as `token_type`; that is the safe
 * way to be wrong, because a missed name would leak a secret into a report.
 */
const DEFAULT_SENSITIVE_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'cvv',
  'cardnumber',
  'accountnumber',
] as const;

const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g;
const BEARER = /\bBearer\s+[^\s"',]+/gi;

export interface RedactorOptions {
  /** Extra names to mask, added to the defaults; the defaults cannot be removed. */
  sensitiveKeys?: readonly string[];
}

/** Masks secrets before anything is logged, attached or put in an error message. */
export interface Redactor {
  isSensitive(name: string): boolean;
  headers(headers: Readonly<Record<string, string>>): Record<string, string>;
  url(url: string): string;
  /** A request or response body: JSON strings are parsed, so the result stays readable. */
  body(body: unknown): unknown;
  /** Free text that may not be JSON: form bodies, error messages, stack traces. */
  text(text: string): string;
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function createRedactor(options: RedactorOptions = {}): Redactor {
  const keys = [...DEFAULT_SENSITIVE_KEYS, ...(options.sensitiveKeys ?? [])]
    .map(normalise)
    .filter((key) => key !== '');
  const keyValuePair = keyValuePattern(keys);

  const isSensitive = (name: string): boolean => {
    const normalised = normalise(name);
    return keys.some((key) => normalised.includes(key));
  };

  const text = (value: string): string =>
    value
      .replace(JWT, REDACTED)
      .replace(BEARER, `Bearer ${REDACTED}`)
      .replace(keyValuePair, `$1$2${REDACTED}`);

  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return text(value);
    if (value instanceof Uint8Array) return `[binary, ${String(value.byteLength)} bytes]`;
    if (Array.isArray(value)) return value.map(walk);
    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]: [string, unknown]) => [
          key,
          isSensitive(key) && entry !== null ? REDACTED : walk(entry),
        ]),
      );
    }
    return value;
  };

  return {
    isSensitive,
    text,

    headers: (headers) =>
      Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [
          name,
          isSensitive(name) ? REDACTED : text(value),
        ]),
      ),

    url: (url) => {
      if (!URL.canParse(url)) return text(url);
      const { origin, pathname, searchParams } = new URL(url);
      const query = [...searchParams].map(
        ([name, value]) => `${name}=${isSensitive(name) ? REDACTED : text(value)}`,
      );
      return text(`${origin}${pathname}`) + (query.length > 0 ? `?${query.join('&')}` : '');
    },

    body: (body) => {
      if (typeof body !== 'string') return walk(body);
      try {
        return walk(JSON.parse(body));
      } catch {
        return text(body);
      }
    },
  };
}

/** `name=value`, `name: value` and `"name":"value"`, with quoted values kept whole. */
function keyValuePattern(keys: readonly string[]): RegExp {
  const names = keys.map((key) => key.split('').join('[-_]?')).join('|');
  const value = String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^&\s,;}]+`;
  return new RegExp(String.raw`([\w-]*(?:${names})[\w-]*)(["']?\s*[=:]\s*)(?:${value})`, 'gi');
}

/** Redactor with the default key list, for code that has no recorder to ask. */
export const defaultRedactor = createRedactor();

/**
 * Shortens a redacted body whose JSON form exceeds `maxLength`. Run this after
 * redaction, never before: a cut can leave a secret without the name that
 * would have identified it.
 */
export function truncateBody(body: unknown, maxLength: number): unknown {
  if (body === undefined) return body;
  const serialised = typeof body === 'string' ? body : JSON.stringify(body);
  if (serialised.length <= maxLength) return body;
  const omitted = serialised.length - maxLength;
  return `${serialised.slice(0, maxLength)}... [truncated ${String(omitted)} characters]`;
}
