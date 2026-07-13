import { SERVICE_AREA_LEVEL } from "@/lib/categoryCode";
import type { ElementCategory } from "@/types";

/**
 * Resolving a `"Kitchen > Cabinets > Base Cabinets"` cell against the org's
 * taxonomy. Shared by both importers (elements, BOQ), both exporters, and the
 * bulk-upsert writer — they must all agree on what a path means and on the
 * wording they reject it with.
 */

/**
 * Normalize a category path segment for lookup. Unlike headers, category
 * names are case-sensitive by design ("PVC" ≠ "Pvc"); we only trim and
 * collapse inner whitespace.
 */
export function normalizeCategorySegment(s: string): string {
  return s
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Build a `"root > child > leaf"` → categoryId map for path lookup. */
export function buildCategoryPathMap(
  categories: Array<Pick<ElementCategory, "id" | "name" | "parent_id">>
): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const map = new Map<string, string>();
  for (const cat of categories) {
    map.set(
      ancestryOf(cat, byId).map(normalizeCategorySegment).join(" > "),
      cat.id
    );
  }
  return map;
}

/**
 * categoryId → tree level. Both the preview parsers and the bulk-upsert writer
 * need it to reject a path that doesn't name a Service Area.
 */
export function buildCategoryLevelMap(
  categories: Array<Pick<ElementCategory, "id" | "level">>
): Map<string, number> {
  return new Map(categories.map((c) => [c.id, c.level]));
}

/** Inverse map: categoryId → `["root", "child", "leaf"]` for the export writers. */
export function buildCategoryPathById(
  categories: Array<Pick<ElementCategory, "id" | "name" | "parent_id">>
): Map<string, string[]> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return new Map(categories.map((c) => [c.id, ancestryOf(c, byId)]));
}

function ancestryOf(
  cat: Pick<ElementCategory, "name" | "parent_id">,
  byId: Map<string, Pick<ElementCategory, "name" | "parent_id">>
): string[] {
  const parts: string[] = [cat.name];
  let parentId = cat.parent_id;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parent_id;
  }
  return parts;
}

/**
 * Shared message for the level check. The parsers reject at preview time and
 * `bulkUpsertElements` rejects again at write time (the write path is reachable
 * without the preview) — so the two must not drift apart.
 */
export function notAServiceAreaError(path: string[]): string {
  return `Category path "${path.join(" > ")}" is not a Service Area — it must name one`;
}

export type CategoryPathResolution =
  | { ok: true; id: string; segments: string[] }
  | { ok: false; error: string };

/**
 * Resolve a non-empty `Category Path` cell to a Service Area id. The *missing*
 * case is deliberately left to the caller: the element sheet has no fallback,
 * while a BOQ row can inherit its Service Area from a linked element — so the
 * two want different wording for "you didn't give me one".
 */
export function resolveCategoryPathCell(
  cell: string,
  pathMap: Map<string, string>,
  levelById: Map<string, number>
): CategoryPathResolution {
  const segments = cell.split(">").map((s) => s.trim());
  if (segments.some((s) => s.length === 0)) {
    return {
      ok: false,
      error:
        "Category Path has empty segments — use 'A > B > C' with non-empty labels",
    };
  }

  const id = pathMap.get(segments.map(normalizeCategorySegment).join(" > "));
  if (!id) {
    return {
      ok: false,
      error: `Category path "${segments.join(" > ")}" not found in this org`,
    };
  }
  if (levelById.get(id) !== SERVICE_AREA_LEVEL) {
    return { ok: false, error: notAServiceAreaError(segments) };
  }
  return { ok: true, id, segments };
}
