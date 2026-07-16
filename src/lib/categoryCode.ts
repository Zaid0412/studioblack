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
 * Prefix for an element whose category yields no code.
 *
 * Mostly that means a row predating the Service Area rule (and the
 * `migrate-element-code-auto.sql` backfill of them) — but it also catches a
 * Service Area with a blank `code_prefix`, which the category schema still
 * permits. So this is a live fallback, not purely a legacy one.
 */
export const UNCATEGORIZED_PREFIX = "GEN";

/**
 * `element_category.level` of a Service Area — the leaf of
 * Category → Sub-category → Service Area, and the only level an element may be
 * filed under.
 */
export const SERVICE_AREA_LEVEL = 3;

/** `element_category.level` of a top-level Category — the root of every path. */
export const CATEGORY_LEVEL = 1;

/** `element_category.code_prefix` is VARCHAR(20). */
export const CATEGORY_CODE_MAX = 20;

/**
 * Defaults for an org with no `category_code_config` row. Lives here (a pure,
 * client-safe module) rather than in the query module so client hooks can read
 * it without pulling the `pg` driver into the browser bundle.
 */
export const CATEGORY_CODE_CONFIG_DEFAULTS = {
  auto_generate: true,
  code_max_length: 4,
  force_uppercase: true,
  prevent_duplicates: true,
  lock_after_use: true,
} as const;

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

/**
 * Suggest a code segment from a category name — the auto-generation default
 * ("Kitchen" → `KIT`, "Base Cabinets" → `BASE`). Takes the first alphanumeric
 * word, uppercases it, and clamps to `maxLen`. It's only a suggestion the user
 * can edit, so it need not match the curated seed codes exactly. Returns `""`
 * for an empty or symbol-only name (the caller then leaves the field blank).
 */
export function suggestCodeSegment(name: string, maxLen: number): string {
  const firstWord = name.match(/[A-Za-z0-9]+/)?.[0] ?? "";
  return firstWord.toUpperCase().slice(0, Math.max(0, maxLen));
}

/**
 * Apply the org's `force_uppercase` option to a raw segment. Kept separate from
 * `normalizeCodeSegment` (which always uppercases and is relied on app-wide,
 * including element-code composition) so the lowercase-allowed path doesn't
 * change that shared helper. Always strips non-alphanumerics.
 */
export function applyCase(segment: string, forceUppercase: boolean): string {
  const stripped = segment.replace(/[^A-Za-z0-9]/g, "");
  return forceUppercase ? stripped.toUpperCase() : stripped;
}

/**
 * Make `segment` unique among its siblings' segments (case-insensitive). If it
 * already collides, append an incrementing number, truncating the base so the
 * result still fits `maxLen` (`BASE` → `BASE2`; at cap 4 → `BAS2`). Returns the
 * segment unchanged when there's no collision.
 */
export function dedupeSegment(
  segment: string,
  takenSegments: Iterable<string>,
  maxLen: number
): string {
  const taken = new Set(Array.from(takenSegments, (s) => s.toUpperCase()));
  if (!segment || !taken.has(segment.toUpperCase())) return segment;
  for (let n = 2; n < 1000; n++) {
    const suffix = String(n);
    const base = segment.slice(0, Math.max(0, maxLen - suffix.length));
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate.toUpperCase())) return candidate;
  }
  return segment;
}
