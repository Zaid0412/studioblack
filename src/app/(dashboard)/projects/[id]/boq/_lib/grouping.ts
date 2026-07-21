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

interface BuildBoqGroupsParams {
  items: BoqItemWithComputed[];
  sections: BoqSection[];
  /** Sell-price total for a real section (from the server summary). */
  sectionTotal: (sectionId: string) => number;
  divisionName: (divisionId: string | null) => string | null;
  divisionRank: (divisionId: string | null) => number;
}

const looseKey = (divisionId: string | null): string => divisionId ?? "none";

/**
 * Group BOQ line items **by division first**: every division that has any items
 * (via a section or directly) renders under its own band. Within a division the
 * order matches the server's canonical line-number order
 * (`BOQ_GLOBAL_ORDER_BY`): sections by `sort_order`, then the section-less items
 * last. Section-less items are collected per division so a line filed straight
 * under a division — no section — still appears beneath that division rather
 * than in one global "unassigned" bucket.
 *
 * Pure and injection-based (totals / division lookups passed in) so it unit-tests
 * without SWR or React.
 */
export function buildBoqGroups({
  items,
  sections,
  sectionTotal,
  divisionName,
  divisionRank,
}: BuildBoqGroupsParams): BoqRenderGroup[] {
  const bySection = new Map<string, BoqItemWithComputed[]>();
  const looseByDivision = new Map<string, BoqItemWithComputed[]>();
  for (const item of items) {
    if (item.section_id === null) {
      const key = looseKey(item.division_id);
      const bucket = looseByDivision.get(key);
      if (bucket) bucket.push(item);
      else looseByDivision.set(key, [item]);
      continue;
    }
    const bucket = bySection.get(item.section_id);
    if (bucket) bucket.push(item);
    else bySection.set(item.section_id, [item]);
  }

  // Every division that owns a section and/or loose items, ranked (null last).
  const divisionIds = new Set<string | null>();
  for (const s of sections) divisionIds.add(s.division_id);
  for (const key of looseByDivision.keys())
    divisionIds.add(key === "none" ? null : key);
  const orderedDivisions = [...divisionIds].sort(
    (a, b) => divisionRank(a) - divisionRank(b)
  );

  // Sections in continuous line-number order (division rank, then sort_order).
  const orderedSections = [...sections].sort(
    (a, b) =>
      divisionRank(a.division_id) - divisionRank(b.division_id) ||
      a.sort_order - b.sort_order
  );

  const looseTotal = (list: BoqItemWithComputed[]): number =>
    list.reduce((sum, it) => sum + toNum(it.sell_price), 0);

  const result: BoqRenderGroup[] = [];
  for (const divId of orderedDivisions) {
    const name = divisionName(divId);
    for (const section of orderedSections) {
      if (section.division_id !== divId) continue;
      result.push({
        id: section.id,
        title: section.title,
        section,
        visibleToClient: section.is_visible_to_client,
        items: bySection.get(section.id) ?? [],
        total: sectionTotal(section.id),
        divisionId: divId,
        divisionName: name,
      });
    }
    const loose = looseByDivision.get(looseKey(divId));
    if (loose && loose.length > 0) {
      result.push({
        id: `${BOQ_NO_SECTION_ID}:${looseKey(divId)}`,
        title: "(Unassigned)",
        section: null,
        items: loose,
        total: looseTotal(loose),
        divisionId: divId,
        divisionName: name,
      });
    }
  }
  return result;
}
