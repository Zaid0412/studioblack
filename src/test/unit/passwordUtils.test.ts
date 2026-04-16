import { describe, it, expect } from "vitest";
import { getStrength, barColor, labelColor } from "@/lib/passwordUtils";

// ── getStrength ─────────────────────────────────────────────────────────────

describe("getStrength", () => {
  it("returns 0 for empty string", () => {
    expect(getStrength("")).toBe(0);
  });

  it("returns 3 for short password with mixed case, digit, and special", () => {
    // Length < 8 so length criterion not met, but other 3 are
    expect(getStrength("aB1!")).toBe(3);
  });

  it("returns 1 for password with only length >= 8", () => {
    expect(getStrength("aaaaaaaa")).toBe(1);
  });

  it("returns 2 for length + mixed case", () => {
    expect(getStrength("aaAAaaaa")).toBe(2);
  });

  it("returns 2 for length + digit", () => {
    expect(getStrength("aaaa1111")).toBe(2);
  });

  it("returns 2 for length + special char", () => {
    expect(getStrength("aaaa!!!!")).toBe(2);
  });

  it("returns 3 for length + mixed case + digit", () => {
    expect(getStrength("aaAA1111")).toBe(3);
  });

  it("returns 3 for length + mixed case + special", () => {
    expect(getStrength("aaAA!!!!")).toBe(3);
  });

  it("returns 4 for password meeting all criteria", () => {
    expect(getStrength("aA1!aaaa")).toBe(4);
  });

  it("increments for each requirement independently", () => {
    // Short with all types = 3 (length not met, other 3 met)
    expect(getStrength("aB1!")).toBe(3);
    // Long lowercase only = 1 (only length met)
    expect(getStrength("abcdefgh")).toBe(1);
    // Long + upper + lower + digit + special = 4
    expect(getStrength("Abcdefg1!")).toBe(4);
  });
});

// ── barColor ────────────────────────────────────────────────────────────────

describe("barColor", () => {
  it("returns bg-error for strength 0", () => {
    expect(barColor(0)).toBe("bg-error");
  });

  it("returns bg-error for strength 1", () => {
    expect(barColor(1)).toBe("bg-error");
  });

  it("returns bg-warning for strength 2", () => {
    expect(barColor(2)).toBe("bg-warning");
  });

  it("returns bg-success for strength 3", () => {
    expect(barColor(3)).toBe("bg-success");
  });

  it("returns bg-success for strength 4", () => {
    expect(barColor(4)).toBe("bg-success");
  });
});

// ── labelColor ──────────────────────────────────────────────────────────────

describe("labelColor", () => {
  it("returns text-error for strength 0", () => {
    expect(labelColor(0)).toBe("text-error");
  });

  it("returns text-error for strength 1", () => {
    expect(labelColor(1)).toBe("text-error");
  });

  it("returns text-warning for strength 2", () => {
    expect(labelColor(2)).toBe("text-warning");
  });

  it("returns text-success for strength 3", () => {
    expect(labelColor(3)).toBe("text-success");
  });

  it("returns text-success for strength 4", () => {
    expect(labelColor(4)).toBe("text-success");
  });
});
