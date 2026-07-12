/**
 * Category path codes and the element codes derived from them.
 *
 * A category carries the *full* path code at every level — `KIT`, `KIT-CAB`,
 * `KIT-CAB-BASE` (see `categoryTemplates.ts`). An element's code is its
 * category's path code plus a 4-digit sequence: `KIT-CAB-BASE-0001`.
 *
 * Pure string helpers only — safe to import from client components. The
 * sequence itself is server-side (`queries/sequences.ts`).
 */

/**
 * Prefix for an element with no category, or whose category has no code.
 *
 * New elements must sit under a Service Area, so this only ever codes rows that
 * predate that rule (and the `migrate-element-code-auto.sql` backfill of them).
 */
export const UNCATEGORIZED_PREFIX = "GEN";

/**
 * `element_category.level` of a Service Area — the leaf of
 * Category → Sub-category → Service Area, and the only level an element may be
 * filed under.
 */
export const SERVICE_AREA_LEVEL = 3;

/** `element_category.code_prefix` is VARCHAR(20). */
export const CATEGORY_CODE_MAX = 20;

/** Path codes are uppercase alphanumeric segments joined by "-". */
export function normalizeCodeSegment(segment: string): string {
  return segment.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * A category's full path code: the parent's code plus this node's own segment
 * (`KIT-CAB` + `BASE` → `KIT-CAB-BASE`). Top-level categories have no parent,
 * so their code is the bare segment.
 */
export function composeCategoryCode(
  parentPrefix: string | null | undefined,
  segment: string
): string {
  const seg = normalizeCodeSegment(segment);
  const parent = parentPrefix?.trim();
  if (!seg) return "";
  return parent ? `${parent}-${seg}` : seg;
}

/**
 * The trailing segment of a full path code — the only part the category form
 * lets a user edit. Codes that don't sit under their parent (legacy rows typed
 * by hand before composition was enforced) are surfaced whole, so the user can
 * see and correct them.
 */
export function codeSegmentOf(
  codePrefix: string | null | undefined,
  parentPrefix: string | null | undefined
): string {
  const code = codePrefix?.trim() ?? "";
  const parent = parentPrefix?.trim() ?? "";
  if (parent && code.startsWith(`${parent}-`)) {
    return code.slice(parent.length + 1);
  }
  return code;
}

/**
 * How long a segment may be under a given parent, so the composed code still
 * fits `CATEGORY_CODE_MAX`. Floors at 0 (which blocks typing) rather than 1: a
 * parent with no room left has no valid segment, so offering one character
 * would only trade an un-typable field for a save that the server rejects.
 * A negative `maxLength` is invalid HTML and would be ignored entirely.
 */
export function maxSegmentLength(
  parentPrefix: string | null | undefined
): number {
  const parent = parentPrefix?.trim();
  if (!parent) return CATEGORY_CODE_MAX;
  return Math.max(0, CATEGORY_CODE_MAX - parent.length - 1);
}
