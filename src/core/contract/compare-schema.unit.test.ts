import { describe, expect, it } from 'vitest';
import { compareToSchema, type JsonSchema } from './compare-schema';

const refs: Record<string, JsonSchema> = {
  '#/brand': { type: 'object', properties: { id: { type: 'string' } } },
  '#/alias': { $ref: '#/brand' },
};
const resolve = (ref: string): JsonSchema => refs[ref] ?? {};

const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
});

describe('compareToSchema', () => {
  it('finds nothing when the value matches', () => {
    const schema = object({ id: { type: 'string' }, price: { type: 'number' } });

    expect(compareToSchema({ id: 'a', price: 1.5 }, schema, resolve)).toEqual([]);
  });

  it('reports a field the schema does not mention', () => {
    expect(compareToSchema({ id: 'a', eco: 1 }, object({ id: {} }), resolve)).toEqual([
      { kind: 'undocumented-field', path: 'eco', detail: 'not in the spec' },
    ]);
  });

  it('reports a documented field that is absent, with no `required` list', () => {
    expect(compareToSchema({}, object({ id: {} }), resolve)).toEqual([
      { kind: 'missing-field', path: 'id', detail: 'documented, but absent from the response' },
    ]);
  });

  it('reports a wrong type', () => {
    expect(compareToSchema({ id: 1 }, object({ id: { type: 'string' } }), resolve)).toEqual([
      { kind: 'type-mismatch', path: 'id', detail: 'documented as string, was number' },
    ]);
  });

  it('reports a wrong type for the whole body', () => {
    expect(compareToSchema([], { type: 'object' }, resolve)).toEqual([
      { kind: 'type-mismatch', path: '(body)', detail: 'documented as object, was array' },
    ]);
  });

  it('does not look inside a value of the wrong type', () => {
    const schema = object({ brand: object({ id: {} }) });

    expect(compareToSchema({ brand: 'x' }, schema, resolve)).toHaveLength(1);
  });

  it('accepts an integer where a number is documented', () => {
    expect(compareToSchema(1, { type: 'number' }, resolve)).toEqual([]);
  });

  it('accepts a whole number where an integer is documented', () => {
    expect(compareToSchema(2, { type: 'integer' }, resolve)).toEqual([]);
  });

  it('rejects a fraction where an integer is documented', () => {
    expect(compareToSchema(1.5, { type: 'integer' }, resolve)).toHaveLength(1);
  });

  it('rejects null unless the schema allows it', () => {
    expect(compareToSchema(null, { type: 'string' }, resolve)).toHaveLength(1);
  });

  it('accepts null through a type list', () => {
    expect(compareToSchema(null, { type: ['string', 'null'] }, resolve)).toEqual([]);
  });

  it('accepts null through `nullable`', () => {
    expect(compareToSchema(null, { type: 'string', nullable: true }, resolve)).toEqual([]);
  });

  it('builds nested paths', () => {
    const schema = object({ brand: object({ id: { type: 'string' } }) });

    expect(compareToSchema({ brand: { id: 1 } }, schema, resolve)[0]?.path).toBe('brand.id');
  });

  it('follows references, including chains', () => {
    expect(compareToSchema({ id: 1 }, { $ref: '#/alias' }, resolve)[0]?.path).toBe('id');
  });

  it('marks array items and reports a repeated finding once', () => {
    const schema = object({ data: { type: 'array', items: object({ id: {} }) } });

    expect(
      compareToSchema(
        {
          data: [
            { id: 1, x: 1 },
            { id: 2, x: 2 },
          ],
        },
        schema,
        resolve,
      ),
    ).toEqual([{ kind: 'undocumented-field', path: 'data[].x', detail: 'not in the spec' }]);
  });

  it('checks every array item, not just the first', () => {
    const schema: JsonSchema = { type: 'array', items: object({ id: { type: 'string' } }) };

    expect(compareToSchema([{ id: 'a' }, { id: 1 }], schema, resolve)).toHaveLength(1);
  });

  it('merges allOf parts', () => {
    const schema: JsonSchema = {
      allOf: [{ $ref: '#/brand' }, object({ name: { type: 'string' } })],
    };

    expect(compareToSchema({ id: 'a', name: 'b' }, schema, resolve)).toEqual([]);
  });

  it('keeps properties declared beside allOf', () => {
    const schema: JsonSchema = {
      allOf: [{ $ref: '#/brand' }],
      properties: { slug: { type: 'string' } },
    };

    expect(compareToSchema({ id: 'a', slug: 'b' }, schema, resolve)).toEqual([]);
  });

  it.each(['oneOf', 'anyOf'] as const)('uses the closest %s alternative', (keyword) => {
    const schema: JsonSchema = {
      [keyword]: [object({ a: {}, b: {} }), object({ id: { type: 'string' } })],
    };

    expect(compareToSchema({ id: 'a', x: 1 }, schema, resolve)).toEqual([
      { kind: 'undocumented-field', path: 'x', detail: 'not in the spec' },
    ]);
  });

  it('prefers an alternative of the right type over one with fewer differences', () => {
    const schema: JsonSchema = {
      oneOf: [{ type: 'array' }, object({ a: {}, b: {}, c: {} })],
    };

    expect(compareToSchema({}, schema, resolve).map(({ kind }) => kind)).toEqual([
      'missing-field',
      'missing-field',
      'missing-field',
    ]);
  });

  it('honours `nullable` beside oneOf', () => {
    const schema: JsonSchema = { nullable: true, oneOf: [{ $ref: '#/brand' }] };

    expect(compareToSchema(null, schema, resolve)).toEqual([]);
  });

  it('honours `nullable` beside a reference', () => {
    expect(compareToSchema(null, { $ref: '#/brand', nullable: true }, resolve)).toEqual([]);
  });

  it('keeps properties declared beside anyOf', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { id: {} },
      anyOf: [{}, {}],
    };

    expect(compareToSchema({ id: 1, extra: 2 }, schema, resolve)).toEqual([
      { kind: 'undocumented-field', path: 'extra', detail: 'not in the spec' },
    ]);
  });

  it('treats an empty oneOf as saying nothing', () => {
    expect(compareToSchema({ a: 1 }, { oneOf: [] }, resolve)).toEqual([]);
  });

  it('does not compare an object with no documented properties', () => {
    expect(compareToSchema({ anything: 1 }, { type: 'object' }, resolve)).toEqual([]);
  });

  it('accepts anything against an empty schema', () => {
    expect(compareToSchema({ anything: [1] }, {}, resolve)).toEqual([]);
  });
});
