import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * insertBoqItemBetween computes the new line number (the midpoint of the gap),
 * shifts sort_order to open a slot, and delegates the row insert to
 * createBoqItem. We run the REAL query fn against a controllable pooled client,
 * routing `client.query` by SQL shape.
 */
const { mockClientQuery, mockRelease } = vi.hoisted(() => ({
  mockClientQuery: vi.fn(),
  mockRelease: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: () =>
      Promise.resolve({ query: mockClientQuery, release: mockRelease }),
    query: mockClientQuery,
  }),
}));

import { insertBoqItemBetween, NeedsRenumberError } from "@/lib/queries/boq";

const ANCHOR = "anchor-1";
const anchor = { itemId: ANCHOR, position: "below" as const };
const input = {
  categoryId: "cat-1",
  description: "x",
  unit: "m2",
};

/** The params of the row-insert (createBoqItem's INSERT). */
const insertParams = () =>
  mockClientQuery.mock.calls.find((c) =>
    /INSERT INTO boq_item/.test(String(c[0]))
  )?.[1] as unknown[] | undefined;

/**
 * @param increment  project line increment
 * @param anchor     the anchor row
 * @param neighbor   the row on the insert side (null = anchor is the edge)
 * @param afterRenumber neighbor to return once the section has been re-spaced
 */
function wire(opts: {
  increment: number;
  anchor: {
    division_id: string;
    section_id: string | null;
    sort_order: number;
    line_number: number;
  };
  neighbor: { line_number: number } | null;
  afterRenumber?: { line_number: number };
}) {
  let renumbered = false;
  mockClientQuery.mockImplementation((sql: string) => {
    if (/INSERT INTO boq_item/.test(sql))
      return Promise.resolve({ rows: [{ id: "new-item" }] });
    // Custom lines now auto-generate item_code from the shared sequence.
    if (/INSERT INTO sequence_counter/.test(sql))
      return Promise.resolve({ rows: [{ current_value: 1 }] });
    // The BOQ-wide continuous renumber (no-gap fallback). Checked before the
    // increment matcher — the renumber UPDATE now embeds the increment subquery.
    if (/line_number = o\.rn/.test(sql)) {
      renumbered = true;
      return Promise.resolve({ rows: [] });
    }
    if (/SELECT pr\.line_increment FROM boq pb/.test(sql))
      return Promise.resolve({ rows: [{ line_increment: opts.increment }] });
    if (
      /SELECT division_id, section_id, sort_order, line_number FROM boq_item WHERE id/.test(
        sql
      )
    )
      return Promise.resolve({ rows: [opts.anchor] });
    // Per-division neighbour lookup (MIN above / MAX below) by line_number,
    // scoped to the anchor's division ($2) — so the line compares to $3.
    if (/line_number > \$3|line_number < \$3/.test(sql)) {
      const n = renumbered ? opts.afterRenumber : opts.neighbor;
      return Promise.resolve({
        rows: [{ line_number: n?.line_number ?? null }],
      });
    }
    return Promise.resolve({ rows: [] }); // BEGIN / COMMIT / shift UPDATE
  });
}

beforeEach(() => {
  mockClientQuery.mockReset();
  mockRelease.mockReset();
});

describe("insertBoqItemBetween", () => {
  it("takes the midpoint of the gap below the anchor", async () => {
    wire({
      increment: 10,
      anchor: { division_id: "div-1", section_id: null, sort_order: 0, line_number: 10 },
      neighbor: { line_number: 20 },
    });

    await insertBoqItemBetween("boq-1", "org-1", anchor, input);

    const params = insertParams()!;
    expect(params[24]).toBe(1); // $25 sort_order = anchor + 1
    expect(params[28]).toBe(15); // $29 line_number = midpoint(10, 20)
  });

  it("appends (anchor + increment) when the anchor is the last row", async () => {
    wire({
      increment: 10,
      anchor: { division_id: "div-1", section_id: null, sort_order: 3, line_number: 30 },
      neighbor: null,
    });

    await insertBoqItemBetween("boq-1", "org-1", anchor, input);

    expect(insertParams()![28]).toBe(40);
  });

  it("throws NeedsRenumberError when the gap can't be split", async () => {
    wire({
      increment: 10,
      anchor: { division_id: "div-1", section_id: null, sort_order: 0, line_number: 10 },
      neighbor: { line_number: 11 },
    });

    await expect(
      insertBoqItemBetween("boq-1", "org-1", anchor, input)
    ).rejects.toThrow(NeedsRenumberError);
    expect(insertParams()).toBeUndefined(); // nothing inserted
  });

  it("re-spaces the section and inserts when allowRenumber is set", async () => {
    wire({
      increment: 10,
      anchor: { division_id: "div-1", section_id: null, sort_order: 0, line_number: 10 },
      neighbor: { line_number: 11 },
      afterRenumber: { line_number: 20 }, // gap reopened by the re-spacing
    });

    await insertBoqItemBetween("boq-1", "org-1", anchor, input, {
      allowRenumber: true,
    });

    expect(insertParams()![28]).toBe(15); // midpoint after re-spacing
  });
});
