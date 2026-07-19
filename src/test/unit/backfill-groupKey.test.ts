import { describe, it, expect } from "vitest";
import { groupKey } from "../../../scripts/backfill-boq-element-ids";

/**
 * The backfill dedups orphan lines into one element per group. The key must:
 * normalize the description (case + whitespace), keep a NULL Service Area
 * distinct from any real one, and separate different Service Areas.
 */
describe("backfill groupKey", () => {
  it("normalizes description case + whitespace within a Service Area", () => {
    expect(groupKey("cat-1", "Glazed Tile")).toBe("cat-1|glazed tile");
    expect(groupKey("cat-1", "  GLAZED tile  ")).toBe(
      groupKey("cat-1", "glazed tile")
    );
  });

  it("keeps a NULL category distinct from a string category", () => {
    expect(groupKey(null, "x")).toBe("∅|x");
    expect(groupKey(null, "x")).not.toBe(groupKey("cat-1", "x"));
  });

  it("separates different Service Areas with the same description", () => {
    expect(groupKey("a", "tile")).not.toBe(groupKey("b", "tile"));
  });

  it("handles a null/empty description", () => {
    expect(groupKey("cat-1", null)).toBe("cat-1|");
    expect(groupKey("cat-1", "   ")).toBe("cat-1|");
  });
});
