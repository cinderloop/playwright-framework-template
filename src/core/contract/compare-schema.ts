/** The parts of an OpenAPI schema this comparison understands. */
export interface JsonSchema {
  $ref?: string;
  type?: string | string[];
  nullable?: boolean;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
}

export type FieldDriftKind = 'undocumented-field' | 'missing-field' | 'type-mismatch';

export interface FieldDrift {
  kind: FieldDriftKind;
  /** Where in the body, with `[]` for any array item, e.g. `data[].price`. */
  path: string;
  detail: string;
}

export type ResolveRef = (ref: string) => JsonSchema;

function jsonTypeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function allowedTypes(schema: JsonSchema): string[] {
  const types = schema.type === undefined ? [] : [schema.type].flat();
  return schema.nullable ? [...types, 'null'] : types;
}

function matchesType(value: unknown, types: readonly string[]): boolean {
  if (types.length === 0) return true;
  const actual = jsonTypeOf(value);
  if (types.includes(actual)) return true;
  return types.includes('integer') && Number.isInteger(value);
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

/**
 * Compares a real value with what a schema documents.
 *
 * A JSON Schema validator answers "is this value allowed?", and a schema with no
 * `required` or `additionalProperties` allows almost anything. This answers "does
 * the documentation describe this value?", so it reports fields the schema does
 * not mention and documented fields that are absent, whether or not the schema
 * forbids them. An object schema without `properties` documents nothing specific
 * and is not compared further.
 */
export function compareToSchema(
  value: unknown,
  schema: JsonSchema,
  resolveRef: ResolveRef,
): FieldDrift[] {
  const resolve = (candidate: JsonSchema): JsonSchema => {
    const { $ref, ...siblings } = candidate;
    return $ref === undefined ? candidate : { ...resolve(resolveRef($ref)), ...siblings };
  };

  const flatten = (candidate: JsonSchema): JsonSchema => {
    const resolved = resolve(candidate);
    if (!resolved.allOf) return resolved;
    const { allOf, ...rest } = resolved;
    return [...allOf.map(flatten), rest].reduce<JsonSchema>(
      (merged, part) => ({
        ...merged,
        ...part,
        ...(merged.properties || part.properties
          ? { properties: { ...merged.properties, ...part.properties } }
          : {}),
      }),
      {},
    );
  };

  /** The alternative the author most likely meant: right type first, then fewest differences. */
  const closest = (results: FieldDrift[][], path: string): FieldDrift[] => {
    const location = path === '' ? '(body)' : path;
    const score = (drift: FieldDrift[]) =>
      drift.some(({ kind, path: at }) => kind === 'type-mismatch' && at === location)
        ? Number.MAX_SAFE_INTEGER
        : drift.length;
    return results.reduce((best, result) => (score(result) < score(best) ? result : best));
  };

  const compare = (current: unknown, candidate: JsonSchema, path: string): FieldDrift[] => {
    const resolved = flatten(candidate);

    const { oneOf, anyOf, ...shared } = resolved;
    const alternatives = oneOf ?? anyOf;
    if (alternatives && alternatives.length > 0) {
      // Each alternative applies together with whatever sits beside `oneOf`.
      const results = alternatives.map((option) =>
        compare(current, { allOf: [shared, option] }, path),
      );
      return closest(results, path);
    }

    const types = allowedTypes(resolved);
    if (!matchesType(current, types)) {
      const detail = `documented as ${types.join(' or ')}, was ${jsonTypeOf(current)}`;
      return [{ kind: 'type-mismatch', path: path === '' ? '(body)' : path, detail }];
    }

    if (Array.isArray(current)) {
      const { items } = resolved;
      return items ? current.flatMap((item) => compare(item, items, `${path}[]`)) : [];
    }

    if (typeof current !== 'object' || current === null || !resolved.properties) return [];

    const { properties } = resolved;
    const entries = Object.entries(current) as [string, unknown][];
    const present = new Set(entries.map(([key]) => key));

    return [
      ...entries.flatMap(([key, entry]): FieldDrift[] => {
        const property = properties[key];
        const entryPath = join(path, key);
        return property
          ? compare(entry, property, entryPath)
          : [{ kind: 'undocumented-field', path: entryPath, detail: 'not in the spec' }];
      }),
      ...Object.keys(properties)
        .filter((key) => !present.has(key))
        .map((key): FieldDrift => ({
          kind: 'missing-field',
          path: join(path, key),
          detail: 'documented, but absent from the response',
        })),
    ];
  };

  // Array items repeat the same finding, so keep one of each.
  const unique = new Map(
    compare(value, schema, '').map((drift) => [`${drift.kind} ${drift.path}`, drift]),
  );
  return [...unique.values()];
}
