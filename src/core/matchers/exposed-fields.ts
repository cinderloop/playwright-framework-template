/**
 * Paths of every field in `value` named in `fields`, at any depth, ignoring
 * case. A field set to `null` still counts: the name alone shows the column is
 * being serialised.
 */
export function findExposedFields(value: unknown, fields: readonly string[]): string[] {
  const wanted = new Set(fields.map((field) => field.toLowerCase()));

  const visit = (current: unknown, path: string): string[] => {
    if (Array.isArray(current)) {
      return current.flatMap((item, index) => visit(item, `${path}[${String(index)}]`));
    }
    if (typeof current !== 'object' || current === null) return [];
    return Object.entries(current).flatMap(([key, entry]: [string, unknown]) => {
      const entryPath = path === '' ? key : `${path}.${key}`;
      return [...(wanted.has(key.toLowerCase()) ? [entryPath] : []), ...visit(entry, entryPath)];
    });
  };

  return visit(value, '');
}
