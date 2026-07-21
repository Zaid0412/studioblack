import { describe, it, expect } from "vitest";
import { buildBoqGroups } from "@/app/(dashboard)/projects/[id]/boq/_lib/grouping";
import type { BoqItemWithComputed, BoqSection } from "@/types";

// Minimal fixtures — only the fields buildBoqGroups reads.
const item = (
  id: string,
  opts: {
    section_id?: string | null;
    division_id: string | null;
    sell?: number;
  }
): BoqItemWithComputed =>
  ({
    id,
    section_id: opts.section_id ?? null,
    division_id: opts.division_id,
    sell_price: opts.sell ?? 0,
  }) as unknown as BoqItemWithComputed;

const section = (
  id: string,
  opts: { division_id: string | null; sort_order: number }
): BoqSection =>
  ({
    id,
    title: id,
    division_id: opts.division_id,
    sort_order: opts.sort_order,
    is_visible_to_client: true,
  }) as unknown as BoqSection;

// Division rank: A=0, B=1, else last.
const divisionRank = (d: string | null) =>
  d === "A" ? 0 : d === "B" ? 1 : Number.MAX_SAFE_INTEGER;
const divisionName = (d: string | null) => (d ? `Div ${d}` : null);
const sectionTotal = () => 0;

describe("buildBoqGroups", () => {
  it("files section-less items under their own division, not one global bucket", () => {
    const groups = buildBoqGroups({
      items: [
        item("i1", { division_id: "A" }),
        item("i2", { division_id: "B" }),
      ],
      sections: [],
      sectionTotal,
      divisionName,
      divisionRank,
    });
    expect(groups.map((g) => [g.divisionId, g.section === null])).toEqual([
      ["A", true],
      ["B", true],
    ]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["i1"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["i2"]);
  });

  it("orders sections before the loose group within a division", () => {
    const groups = buildBoqGroups({
      items: [
        item("loose", { division_id: "A" }),
        item("s1i", { section_id: "s1", division_id: "A" }),
      ],
      sections: [section("s1", { division_id: "A", sort_order: 0 })],
      sectionTotal,
      divisionName,
      divisionRank,
    });
    expect(groups[0].section?.id).toBe("s1");
    expect(groups[1].section).toBeNull();
    expect(groups[1].divisionId).toBe("A");
    expect(groups[1].items.map((i) => i.id)).toEqual(["loose"]);
  });

  it("orders divisions by rank, with the null division last", () => {
    const groups = buildBoqGroups({
      items: [
        item("b", { division_id: "B" }),
        item("a", { division_id: "A" }),
        item("none", { division_id: null }),
      ],
      sections: [],
      sectionTotal,
      divisionName,
      divisionRank,
    });
    expect(groups.map((g) => g.divisionId)).toEqual(["A", "B", null]);
  });

  it("sums a loose group's total from item sell prices", () => {
    const groups = buildBoqGroups({
      items: [
        item("i1", { division_id: "A", sell: 100 }),
        item("i2", { division_id: "A", sell: 50 }),
      ],
      sections: [],
      sectionTotal,
      divisionName,
      divisionRank,
    });
    expect(groups[0].total).toBe(150);
  });

  it("renders a division that has only sections (no loose items)", () => {
    const groups = buildBoqGroups({
      items: [item("s1i", { section_id: "s1", division_id: "A" })],
      sections: [section("s1", { division_id: "A", sort_order: 0 })],
      sectionTotal,
      divisionName,
      divisionRank,
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].section?.id).toBe("s1");
  });
});
