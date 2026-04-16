import { describe, it, expect } from "vitest";
import { sortPinsByDate, isPinned, buildPinIndexMap } from "@/lib/pinUtils";
import type { DbPinComment } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE: Omit<DbPinComment, "id" | "created_at"> = {
  attachment_id: "att-1",
  user_id: "user-1",
  user_name: "Test User",
  x_percent: null,
  y_percent: null,
  page: null,
  content: "comment",
  resolved: false,
  task_id: null,
  request_approval: false,
  request_changes: false,
  parent_id: null,
  updated_at: null,
  reply_count: 0,
};

function makePin(
  overrides: Partial<DbPinComment> & { id: string; created_at: string }
): DbPinComment {
  return { ...BASE, ...overrides };
}

const pinA = makePin({
  id: "a",
  created_at: "2026-04-10T10:00:00Z",
  x_percent: 10,
  y_percent: 20,
  page: 1,
});

const pinB = makePin({
  id: "b",
  created_at: "2026-04-12T10:00:00Z",
  x_percent: 50,
  y_percent: 60,
  page: 2,
});

const pinC = makePin({
  id: "c",
  created_at: "2026-04-11T10:00:00Z",
  x_percent: 30,
  y_percent: 40,
  page: 1,
});

const unpinnedComment = makePin({
  id: "d",
  created_at: "2026-04-09T10:00:00Z",
});

// ── sortPinsByDate ──────────────────────────────────────────────────────────

describe("sortPinsByDate", () => {
  it("sorts pins by created_at ascending", () => {
    const sorted = sortPinsByDate([pinB, pinA, pinC]);
    expect(sorted.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate original array", () => {
    const original = [pinB, pinA];
    sortPinsByDate(original);
    expect(original[0].id).toBe("b");
  });

  it("handles empty array", () => {
    expect(sortPinsByDate([])).toEqual([]);
  });

  it("handles single element", () => {
    const sorted = sortPinsByDate([pinA]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe("a");
  });
});

// ── isPinned ────────────────────────────────────────────────────────────────

describe("isPinned", () => {
  it("returns true for pin with coordinates and page", () => {
    expect(isPinned(pinA)).toBe(true);
  });

  it("returns false when x_percent is null", () => {
    expect(isPinned(unpinnedComment)).toBe(false);
  });

  it("returns false when only x_percent is set", () => {
    const partial = makePin({
      id: "e",
      created_at: "2026-04-10T10:00:00Z",
      x_percent: 10,
    });
    expect(isPinned(partial)).toBe(false);
  });

  it("returns false when page is null but coords are set", () => {
    const noPage = makePin({
      id: "f",
      created_at: "2026-04-10T10:00:00Z",
      x_percent: 10,
      y_percent: 20,
    });
    expect(isPinned(noPage)).toBe(false);
  });
});

// ── buildPinIndexMap ────────────────────────────────────────────────────────

describe("buildPinIndexMap", () => {
  it("builds 1-based index map for pinned comments ordered by date", () => {
    const map = buildPinIndexMap([pinB, unpinnedComment, pinA, pinC]);
    expect(map.get("a")).toBe(1); // earliest pinned
    expect(map.get("c")).toBe(2);
    expect(map.get("b")).toBe(3); // latest pinned
  });

  it("excludes unpinned comments", () => {
    const map = buildPinIndexMap([unpinnedComment, pinA]);
    expect(map.has("d")).toBe(false);
    expect(map.get("a")).toBe(1);
  });

  it("returns empty map for no pins", () => {
    const map = buildPinIndexMap([unpinnedComment]);
    expect(map.size).toBe(0);
  });

  it("returns empty map for empty array", () => {
    const map = buildPinIndexMap([]);
    expect(map.size).toBe(0);
  });
});
