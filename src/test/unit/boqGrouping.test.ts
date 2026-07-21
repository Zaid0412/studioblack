import { describe, it, expect } from "vitest";
import { buildDivisionBlocks } from "@/app/(dashboard)/projects/[id]/boq/_lib/grouping";
import type { BoqItemWithComputed, BoqSection } from "@/types";

// Minimal fixtures — only the fields buildDivisionBlocks reads.
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

const build = (
  items: BoqItemWithComputed[],
  sections: BoqSection[],
  totals: () => number = sectionTotal
) =>
  buildDivisionBlocks({
    items,
    sections,
    sectionTotal: totals,
    divisionName,
    divisionRank,
  });

describe("buildDivisionBlocks", () => {
  it("files section-less items under their own division, not one global bucket", () => {
    const blocks = build(
      [item("i1", { division_id: "A" }), item("i2", { division_id: "B" })],
      []
    );
    expect(blocks.map((b) => b.divisionId)).toEqual(["A", "B"]);
    expect(blocks[0].loose?.items.map((i) => i.id)).toEqual(["i1"]);
    expect(blocks[1].loose?.items.map((i) => i.id)).toEqual(["i2"]);
    expect(blocks.every((b) => b.sections.length === 0)).toBe(true);
  });

  it("keeps sections and the loose group together in one division block", () => {
    const blocks = build(
      [
        item("loose", { division_id: "A" }),
        item("s1i", { section_id: "s1", division_id: "A" }),
      ],
      [section("s1", { division_id: "A", sort_order: 0 })]
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].sections.map((g) => g.id)).toEqual(["s1"]);
    expect(blocks[0].loose?.items.map((i) => i.id)).toEqual(["loose"]);
    expect(blocks[0].itemCount).toBe(2);
  });

  it("orders divisions by rank, with the null division last", () => {
    const blocks = build(
      [
        item("b", { division_id: "B" }),
        item("a", { division_id: "A" }),
        item("none", { division_id: null }),
      ],
      []
    );
    expect(blocks.map((b) => b.divisionId)).toEqual(["A", "B", null]);
  });

  it("orders a division's sections by sort_order", () => {
    const blocks = build(
      [],
      [
        section("second", { division_id: "A", sort_order: 1 }),
        section("first", { division_id: "A", sort_order: 0 }),
      ]
    );
    expect(blocks[0].sections.map((g) => g.id)).toEqual(["first", "second"]);
  });

  it("rolls up the block total from loose sell prices + section totals", () => {
    const blocks = build(
      [
        item("i1", { division_id: "A", sell: 100 }),
        item("i2", { division_id: "A", sell: 50 }),
      ],
      [],
      () => 0
    );
    expect(blocks[0].loose?.total).toBe(150);
    expect(blocks[0].total).toBe(150);
  });
});
