/**
 * `createBoqItem` auto-generates the Element code for a custom line (no linked
 * element, no supplied code) from its Service Area — the same Library format
 * (`KIT-CAB-BASE-0001`) drawn from the shared per-prefix sequence. Lines that
 * already carry a code (linked element, import) are left untouched.
 *
 * The real fn is behind the module-level `@/lib/queries` mock, so we pull it via
 * `vi.importActual` and pass a shape-routed mock executor directly (bypassing the
 * `addBoqItem` transaction wrapper — `createBoqItem` accepts the executor).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { BoqItemWithComputed } from "@/types";
import type { CreateBoqItemInput } from "@/lib/queries/boq";

const ORG = "org-test-001";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const CATEGORY_ID = "550e8400-e29b-41d4-a716-446655440009";
const PREFIX = "KIT-CAB-BASE";

const mockQuery = vi.fn();
const executor = { query: mockQuery };

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

/**
 * Route the generation + insert queries by SQL shape. `collisions` is how many
 * of the first candidates report as already-taken (to exercise the self-heal).
 */
function wire(opts: { collisions?: number } = {}) {
  let counter = 0;
  let collisionsLeft = opts.collisions ?? 0;
  mockQuery.mockImplementation((sql: string) => {
    if (/code_prefix FROM element_category/.test(sql))
      return Promise.resolve({ rows: [{ code_prefix: PREFIX }] });
    // bumpSequenceCounter — advance and hand back the new value.
    if (
      /INSERT INTO sequence_counter/.test(sql) &&
      /RETURNING current_value/.test(sql)
    )
      return Promise.resolve({ rows: [{ current_value: ++counter }] });
    // syncElementCounter's high-water read + its GREATEST upsert (no RETURNING).
    if (/SELECT MAX\(suffix/.test(sql))
      return Promise.resolve({ rows: [{ max_seq: String(counter) }] });
    if (/INSERT INTO sequence_counter/.test(sql))
      return Promise.resolve({ rows: [] });
    if (/pg_advisory_xact_lock/.test(sql)) return Promise.resolve({ rows: [] });
    // Collision check across element + boq_item — report a hit until spent.
    if (/SELECT 1 FROM element/.test(sql) && /FROM boq_item bi/.test(sql)) {
      const hit = collisionsLeft > 0;
      if (hit) collisionsLeft--;
      return Promise.resolve({ rows: hit ? [{ "?column?": 1 }] : [] });
    }
    if (/INSERT INTO boq_item/.test(sql))
      return Promise.resolve({ rows: [{ id: "new-item-id" }] });
    return Promise.resolve({ rows: [] });
  });
}

/** The item_code ($6) bound to the boq_item INSERT. */
const insertedCode = () =>
  (
    mockQuery.mock.calls.find((c) =>
      /INSERT INTO boq_item/.test(String(c[0]))
    )?.[1] as unknown[]
  )?.[5];

const bumpCount = () =>
  mockQuery.mock.calls.filter(
    (c) =>
      /INSERT INTO sequence_counter/.test(String(c[0])) &&
      /RETURNING current_value/.test(String(c[0]))
  ).length;

const base: CreateBoqItemInput = {
  categoryId: CATEGORY_ID,
  description: "Custom base cabinet run",
  unit: "no",
};

beforeEach(() => mockQuery.mockReset());

describe("createBoqItem — element code auto-generation", () => {
  it("generates a Library-format code for a custom line with no code", async () => {
    wire();
    await realCreateBoqItem(base);
    expect(insertedCode()).toBe(`${PREFIX}-0001`);
    expect(bumpCount()).toBe(1);
  });

  it("checks the candidate against element AND boq_item", async () => {
    wire();
    await realCreateBoqItem(base);
    const collision = mockQuery.mock.calls.find(
      (c) =>
        /SELECT 1 FROM element/.test(String(c[0])) &&
        /FROM boq_item bi/.test(String(c[0]))
    );
    expect(collision).toBeDefined();
  });

  it("self-heals past a collision and takes the next number", async () => {
    wire({ collisions: 1 });
    await realCreateBoqItem(base);
    // First candidate collided → sync + a second bump → -0002.
    expect(insertedCode()).toBe(`${PREFIX}-0002`);
    expect(bumpCount()).toBe(2);
  });

  it("preserves a supplied code and generates nothing", async () => {
    wire();
    await realCreateBoqItem({ ...base, itemCode: "LEGACY-01" });
    expect(insertedCode()).toBe("LEGACY-01");
    expect(bumpCount()).toBe(0);
  });

  it("does not generate for a library-linked line", async () => {
    wire();
    await realCreateBoqItem({ ...base, elementId: "el-1" });
    expect(insertedCode()).toBeNull();
    expect(bumpCount()).toBe(0);
  });

  it("does not generate when the line has no Service Area", async () => {
    wire();
    await realCreateBoqItem({ description: "x", unit: "no" });
    expect(insertedCode()).toBeNull();
    expect(bumpCount()).toBe(0);
  });
});
