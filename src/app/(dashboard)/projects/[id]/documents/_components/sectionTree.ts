import type { DbProjectDocumentSection } from "@/types";

/** A section is top-level when it has no parent (depth = 0). */
export function isTopLevel(s: DbProjectDocumentSection): boolean {
  return s.parent_id === null;
}

export interface SectionTree {
  topLevel: DbProjectDocumentSection[];
  childrenByParent: Map<string, DbProjectDocumentSection[]>;
  byId: Map<string, DbProjectDocumentSection>;
}

/**
 * Group flat sections into a one-level tree, sorted by position then
 * creation time. Used by the sidebar (renders by parent/child), the
 * tree picker (flattens with depth tags), and any other surface that
 * needs to walk children-of-parent.
 */
export function buildSectionTree(
  sections: DbProjectDocumentSection[]
): SectionTree {
  const sorted = [...sections].sort(
    (a, b) =>
      a.position - b.position || a.created_at.localeCompare(b.created_at)
  );
  const topLevel: DbProjectDocumentSection[] = [];
  const childrenByParent = new Map<string, DbProjectDocumentSection[]>();
  const byId = new Map<string, DbProjectDocumentSection>();
  for (const s of sorted) {
    byId.set(s.id, s);
    if (s.parent_id) {
      const arr = childrenByParent.get(s.parent_id) ?? [];
      arr.push(s);
      childrenByParent.set(s.parent_id, arr);
    } else {
      topLevel.push(s);
    }
  }
  return { topLevel, childrenByParent, byId };
}

/**
 * "Parent / Child" path for sub-sections, or just the section name for
 * top-level. Falls back to the leaf name when the parent isn't in the
 * supplied map (shouldn't happen, but defensible).
 */
export function sectionFullPath(
  section: DbProjectDocumentSection,
  byId: Map<string, DbProjectDocumentSection>
): string {
  if (!section.parent_id) return section.name;
  const parent = byId.get(section.parent_id);
  return parent ? `${parent.name} / ${section.name}` : section.name;
}
