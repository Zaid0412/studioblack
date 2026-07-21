import type { BoqItemWithComputed, BoqSection } from "@/types";
import { BOQ_NO_SECTION_ID, toNum } from "./formatters";

/**
 * One render group in the BOQ table. A group is either a real section
 * (`section` set) or a division's **section-less** items (`section === null`,
 * rendered header-less directly under the division band).
 */
export interface BoqRenderGroup {
  id: string;
  title: string;
  section: BoqSection | null;
  visibleToClient?: boolean;
  items: BoqItemWithComputed[];
  total: number;
  divisionId: string | null;
  divisionName: string | null;
}

/**
 * A division and everything filed under it: its sections (in order) plus an
 * optional header-less loose group for section-less items, with the division's
 * rolled-up item count and total. This is the shape the table renders — one
 * band per block, sections then loose within it.
 */
export interface BoqDivisionBlock {
  divisionId: string | null;
  divisionName: string | null;
  itemCount: number;
  total: number;
  sections: BoqRenderGroup[];
  loose: BoqRenderGroup | null;
}

interface BuildDivisionBlocksParams {
  items: BoqItemWithComputed[];
  sections: BoqSection[];
  /** Sell-price total for a real section (from the server summary). */
  sectionTotal: (sectionId: string) => number;
  divisionName: (divisionId: string | null) => string | null;
  divisionRank: (divisionId: string | null) => number;
}

const divKeyOf = (divisionId: string | null): string => divisionId ?? "none";

/**
 * Group BOQ line items **by division first**, into render-ready division blocks.
 * Every division that has any items (via a section or directly) becomes a block;
 * within it the order matches the server's canonical line-number order
 * (`BOQ_GLOBAL_ORDER_BY`): sections by `sort_order`, then the section-less items
 * last. Section-less items are collected per division so a line filed straight
 * under a division — no section — still appears beneath that division rather
 * than in one global "unassigned" bucket.
 *
 * Owns the per-division `itemCount`/`total` rollup so the renderer (and the chip
 * nav) consume this directly instead of re-deriving the grouping. Pure and
 * injection-based (totals / division lookups passed in) so it unit-tests without
 * SWR or React.
 */
export function buildDivisionBlocks({
  items,
  sections,
  sectionTotal,
  divisionName,
  divisionRank,
}: BuildDivisionBlocksParams): BoqDivisionBlock[] {
  const bySection = new Map<string, BoqItemWithComputed[]>();
  const looseByDivision = new Map<string, BoqItemWithComputed[]>();
  for (const item of items) {
    if (item.section_id === null) {
      pushInto(looseByDivision, divKeyOf(item.division_id), item);
      continue;
    }
    pushInto(bySection, item.section_id, item);
  }

  // Sections bucketed by division in one pass, then each small bucket ordered by
  // `sort_order` — avoids an O(divisions × sections) rescan.
  const sectionsByDivision = new Map<string, BoqSection[]>();
  for (const s of sections)
    pushInto(sectionsByDivision, divKeyOf(s.division_id), s);
  for (const bucket of sectionsByDivision.values())
    bucket.sort((a, b) => a.sort_order - b.sort_order);

  // Every division that owns a section and/or loose items, ranked (null last).
  const divisionIds = new Set<string | null>();
  for (const s of sections) divisionIds.add(s.division_id);
  for (const key of looseByDivision.keys())
    divisionIds.add(key === "none" ? null : key);
  const orderedDivisions = [...divisionIds].sort(
    (a, b) => divisionRank(a) - divisionRank(b)
  );

  const sumTotal = (list: BoqItemWithComputed[]): number =>
    list.reduce((sum, it) => sum + toNum(it.sell_price), 0);

  return orderedDivisions.map((divId) => {
    const name = divisionName(divId);
    const key = divKeyOf(divId);

    const sectionGroups: BoqRenderGroup[] = (
      sectionsByDivision.get(key) ?? []
    ).map((section) => ({
      id: section.id,
      title: section.title,
      section,
      visibleToClient: section.is_visible_to_client,
      items: bySection.get(section.id) ?? [],
      total: sectionTotal(section.id),
      divisionId: divId,
      divisionName: name,
    }));

    const looseItems = looseByDivision.get(key);
    const loose: BoqRenderGroup | null =
      looseItems && looseItems.length > 0
        ? {
            id: `${BOQ_NO_SECTION_ID}:${key}`,
            title: "(Unassigned)",
            section: null,
            items: looseItems,
            total: sumTotal(looseItems),
            divisionId: divId,
            divisionName: name,
          }
        : null;

    const itemCount =
      sectionGroups.reduce((n, g) => n + g.items.length, 0) +
      (loose?.items.length ?? 0);
    const total =
      sectionGroups.reduce((n, g) => n + g.total, 0) + (loose?.total ?? 0);

    return {
      divisionId: divId,
      divisionName: name,
      itemCount,
      total,
      sections: sectionGroups,
      loose,
    };
  });
}

/** Push `value` into the array at `key`, creating the array on first use. */
function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}
