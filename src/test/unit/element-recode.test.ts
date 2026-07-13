/**
 * The re-code rule in `updateElement`: moving an element to a different Service
 * Area reissues its code, so the code never lies about where the element lives.
 *
 * `code` is absent from ELEMENT_COLS — this is the only path that writes it
 * after creation, and it is driven by the category, never by the request body.
 * Uses the real implementation via `vi.importActual`, driven through the
 * sequenced pg mock, so the SQL is exercised rather than stubbed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { UpdateElementInput } from "@/lib/queries";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

async function realUpdateElement(
  orgId: string,
  id: string,
  input: UpdateElementInput
) {
  const actual = await vi.importActual<typeof import("@/lib/queries/elements")>(
    "@/lib/queries/elements"
  );
  return actual.updateElement(orgId, id, input);
}

function queue(results: Array<{ rows: unknown[]; rowCount?: number | null }>) {
  for (const r of results) mocks.db.query.mockResolvedValueOnce(r);
}

const ORG = "org-test-001";
const ELEMENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const SERVICE_AREA = "b1ffcd00-ad1c-4f09-bb7e-7ccace491b22";

/** The `code` bound into the UPDATE, or undefined when it wasn't written. */
function updatedCode(): string | undefined {
  const call = mocks.db.query.mock.calls.find(
    (c) => typeof c[0] === "string" && c[0].startsWith("UPDATE element SET")
  );
  if (!call) return undefined;
  const sql = call[0] as string;
  const params = call[1] as unknown[];
  const match = sql.match(/"code" = \$(\d+)/);
  return match ? (params[Number(match[1]) - 1] as string) : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateElement — re-code on category change", () => {
  it("reissues a grandfathered GEN code under its new Service Area", async () => {
    queue([
      { rows: [] }, // BEGIN
      { rows: [{ id: SERVICE_AREA, level: 3, code_prefix: "KIT-CAB-BASE" }] }, // requireServiceArea
      { rows: [{ code: "GEN-0001" }] }, // current code — stale
      { rows: [{ current_value: 6 }] }, // counter bump
      { rows: [] }, // advisory lock
      { rows: [] }, // dup check → free
      { rows: [{ id: ELEMENT_ID, code: "KIT-CAB-BASE-0006" }] }, // UPDATE
      { rows: [] }, // attributes
      { rows: [] }, // COMMIT
    ]);

    await realUpdateElement(ORG, ELEMENT_ID, { categoryId: SERVICE_AREA });

    expect(updatedCode()).toBe("KIT-CAB-BASE-0006");
  });

  // Re-saving an element that hasn't moved must not churn its code or burn a
  // sequence number — the code is the Excel import's join key.
  it("leaves the code alone when it already sits under that Service Area", async () => {
    queue([
      { rows: [] }, // BEGIN
      { rows: [{ id: SERVICE_AREA, level: 3, code_prefix: "KIT-CAB-BASE" }] }, // requireServiceArea
      { rows: [{ code: "KIT-CAB-BASE-0002" }] }, // current code — already correct
      { rows: [{ id: ELEMENT_ID }] }, // UPDATE
      { rows: [] }, // attributes
      { rows: [] }, // COMMIT
    ]);

    await realUpdateElement(ORG, ELEMENT_ID, {
      categoryId: SERVICE_AREA,
      name: "Renamed",
    });

    expect(updatedCode()).toBeUndefined();

    // No counter was touched.
    const bumped = mocks.db.query.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("sequence_counter")
    );
    expect(bumped).toBe(false);
  });

  it("refuses to move an element under a Sub-category", async () => {
    queue([
      { rows: [] }, // BEGIN
      { rows: [{ id: SERVICE_AREA, level: 2, code_prefix: "KIT-CAB" }] }, // requireServiceArea
      { rows: [] }, // ROLLBACK
    ]);

    await expect(
      realUpdateElement(ORG, ELEMENT_ID, { categoryId: SERVICE_AREA })
    ).rejects.toThrow("Category must be a Service Area");

    const rolledBack = mocks.db.query.mock.calls.some(
      (c) => c[0] === "ROLLBACK"
    );
    expect(rolledBack).toBe(true);
  });

  // An edit that doesn't mention the category can't touch the code — including
  // one that smuggles a `code` in the body, which ELEMENT_COLS drops.
  it("never writes the code when the category isn't part of the edit", async () => {
    queue([
      { rows: [] }, // BEGIN
      { rows: [{ id: ELEMENT_ID }] }, // UPDATE
      { rows: [] }, // attributes
      { rows: [] }, // COMMIT
    ]);

    await realUpdateElement(ORG, ELEMENT_ID, {
      name: "Renamed",
      code: "HACK-9999",
    } as UpdateElementInput);

    expect(updatedCode()).toBeUndefined();
  });
});
