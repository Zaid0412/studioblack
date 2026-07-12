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

/** Prefix used when an element has no category, or its category has no code. */
export const UNCATEGORIZED_PREFIX = "GEN";

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
 * fits `CATEGORY_CODE_MAX`. Always at least 1 — a parent long enough to leave
 * no room is a data problem, not something to silently render as a disabled
 * field.
 */
export function maxSegmentLength(
  parentPrefix: string | null | undefined
): number {
  const parent = parentPrefix?.trim();
  if (!parent) return CATEGORY_CODE_MAX;
  return Math.max(1, CATEGORY_CODE_MAX - parent.length - 1);
}
