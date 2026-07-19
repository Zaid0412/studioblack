/**
 * `createBoqItem` master-data auto-create (PRD 2.2): a manual line with no
 * `elementId` creates a `custom` Element in the library — code generated the
 * Library way, provenance recorded (origin BOQ + creator) — and links it, so the
 * line carries a real ElementID. A line that already names an element (or has no
 * Service Area) skips it.
 *
 * The real fn is behind the module-level `@/lib/queries` mock, so we pull it via
 * `vi.importActual` and drive a shape-routed transaction client directly.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BoqItemWithComputed } from "@/types";
import type { CreateBoqItemInput } from "@/lib/queries/boq";

const ORG = "org-test-001";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const DIVISION_ID = "550e8400-e29b-41d4-a716-446655440008";
const CATEGORY_ID = "550e8400-e29b-41d4-a716-446655440009";
const PREFIX = "KIT-CAB-BASE";
const NEW_ELEMENT_ID = "660e8400-e29b-41d4-a716-4466554400aa";

const mockQuery = vi.fn();
// A transaction client (has `release`) — createBoqItem's auto-create branch
// requires one, so the pool-shaped `{ query }` alone would be rejected.
const executor = { query: mockQuery, release: () => {} };

async function realCreateBoqItem(
  input: CreateBoqItemInput
): Promise<BoqItemWithComputed> {
  const actual =
    await vi.importActual<typeof import("@/lib/queries/boq")>(
      "@/lib/queries/boq"
    );
  return actual.createBoqItem(
    BOQ_ID,
    ORG,
    input,
    executor as unknown as import("pg").PoolClient
  );
}

/** Route the resolution / code-gen / element + line inserts by SQL shape. */
function wire() {
  let counter = 0;
  mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
    if (/lower\(d\.code\) = 'gen'/.test(sql))
      return Promise.resolve({ rows: [{ id: "gen-div" }] });
    if (/code_prefix FROM element_category/.test(sql))
      return Promise.resolve({ rows: [{ code_prefix: PREFIX }] });
    if (
      /INSERT INTO sequence_counter/.test(sql) &&
      /RETURNING current_value/.test(sql)
    )
      return Promise.resolve({ rows: [{ current_value: ++counter }] });
    if (/pg_advisory_xact_lock/.test(sql)) return Promise.resolve({ rows: [] });
    // Collision check across element + boq_item — no collision.
    if (/SELECT 1 FROM element/.test(sql) && /FROM boq_item bi/.test(sql))
      return Promise.resolve({ rows: [] });
    // The auto-created element echoes back the generated code ($2).
    if (/INSERT INTO element\b/.test(sql))
      return Promise.resolve({
        rows: [{ id: NEW_ELEMENT_ID, code: params?.[1] }],
      });
    if (/INSERT INTO boq_item/.test(sql))
      return Promise.resolve({ rows: [{ id: "new-item-id" }] });
    return Promise.resolve({ rows: [] });
  });
}

/** The INSERT INTO element call (params), or undefined if none was issued. */
const elementInsert = () =>
  mockQuery.mock.calls.find((c) => /INSERT INTO element\b/.test(String(c[0])));
/** The boq_item INSERT call. */
const lineInsert = () =>
  mockQuery.mock.calls.find((c) => /INSERT INTO boq_item/.test(String(c[0])));
/** The element_attribute INSERT call, if any. */
const attrInsert = () =>
  mockQuery.mock.calls.find((c) =>
    /INSERT INTO element_attribute/.test(String(c[0]))
  );

const base: CreateBoqItemInput = {
  divisionId: DIVISION_ID,
  categoryId: CATEGORY_ID,
  description: "Custom base cabinet run",
  unit: "no",
  createdBy: "user-pm",
};

beforeEach(() => mockQuery.mockReset());

describe("createBoqItem — element auto-create (PRD 2.2)", () => {
  it("auto-creates a custom element and links it for a manual line", async () => {
    wire();
    await realCreateBoqItem(base);

    const el = elementInsert();
    expect(el).toBeDefined();
    const sql = String(el![0]);
    const params = el![1] as unknown[];
    // Provenance: type is a literal, origin BOQ + creator are bound.
    expect(sql).toContain("'custom'");
    expect(sql).toContain("origin_boq_id");
    expect(params[3]).toBe("Custom base cabinet run"); // $4 description
    expect(params[4]).toBe(CATEGORY_ID); // $5 category_id
    expect(params[18]).toBe("user-pm"); // $19 created_by
    expect(params[24]).toBe(BOQ_ID); // $25 origin_boq_id (after image + file cols)

    // The line links the new element and mirrors its code as item_code.
    const line = lineInsert()![1] as unknown[];
    expect(line[2]).toBe(NEW_ELEMENT_ID); // $3 element_id
    expect(line[5]).toBe(`${PREFIX}-0001`); // $6 item_code
  });

  it("names the element after its description when no name is given", async () => {
    wire();
    await realCreateBoqItem(base);
    expect((elementInsert()![1] as unknown[])[2]).toBe(
      "Custom base cabinet run"
    ); // $3 name ← description
  });

  it("does NOT auto-create when the line already links an element", async () => {
    wire();
    await realCreateBoqItem({ ...base, elementId: "el-existing" });
    expect(elementInsert()).toBeUndefined();
    expect((lineInsert()![1] as unknown[])[2]).toBe("el-existing");
  });

  it("does NOT auto-create when the line has no Service Area", async () => {
    wire();
    await realCreateBoqItem({
      divisionId: DIVISION_ID,
      description: "x",
      unit: "no",
    });
    expect(elementInsert()).toBeUndefined();
    expect((lineInsert()![1] as unknown[])[2]).toBeNull(); // element_id
  });

  it("snapshots image + attributes onto the auto-created element", async () => {
    wire();
    await realCreateBoqItem({
      ...base,
      imageUrl: "https://x/img.png",
      attributes: [
        { attribute_key: "Finish", attribute_value: "Matte" },
        { attribute_key: "", attribute_value: "" }, // blank → dropped
      ],
    });

    // image_url is $20 on the element insert (index 19).
    expect((elementInsert()![1] as unknown[])[19]).toBe("https://x/img.png");

    // The element_attribute insert gets the non-blank attribute only.
    const attr = attrInsert();
    expect(attr).toBeDefined();
    const ap = attr![1] as unknown[];
    expect(ap[0]).toBe(NEW_ELEMENT_ID); // element_id
    expect(ap[1]).toEqual(["Finish"]); // keys (blank dropped)
    expect(ap[2]).toEqual(["Matte"]); // values
  });

  it("records line source — 'custom' when auto-created, 'library' when reused", async () => {
    wire();
    await realCreateBoqItem(base); // auto-create
    expect((lineInsert()![1] as unknown[])[3]).toBe("custom"); // $4 source

    mockQuery.mockClear();
    wire();
    await realCreateBoqItem({ ...base, elementId: "el-existing" }); // reuse
    expect((lineInsert()![1] as unknown[])[3]).toBe("library");
  });
});
