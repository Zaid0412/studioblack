/**
 * Stable, field-sorted JSON. `JSON.stringify` preserves object key
 * insertion order, so two semantically identical payloads that differ only
 * in key order would hash to different keys — that breaks idempotency
 * caches keyed on a content hash.
 *
 * Sort recursively so the output is a function of content alone.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalStringify(
          (value as Record<string, unknown>)[k]
        )}`
    )
    .join(",");
  return `{${body}}`;
}
