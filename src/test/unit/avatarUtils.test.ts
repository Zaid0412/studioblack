import { describe, it, expect } from "vitest";
import { avatarColor } from "@/lib/avatarUtils";

describe("avatarColor", () => {
  it("returns a hex color", () => {
    expect(avatarColor("alice")).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("is deterministic (same input → same output)", () => {
    expect(avatarColor("bob")).toBe(avatarColor("bob"));
  });

  it("different inputs can produce different colors", () => {
    const colors = new Set(
      ["alice", "bob", "charlie", "dave", "eve", "frank"].map(avatarColor)
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it("returns a color from the predefined palette", () => {
    const palette = [
      "#3B82F6",
      "#22C55E",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
    ];
    expect(palette).toContain(avatarColor("test-user"));
  });

  it("handles empty string without throwing", () => {
    expect(() => avatarColor("")).not.toThrow();
    expect(avatarColor("")).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
