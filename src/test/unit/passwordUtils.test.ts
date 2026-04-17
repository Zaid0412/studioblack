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

  it("returns 3 for length + digit + special (no mixed case)", () => {
    expect(getStrength("1111!!!!")).toBe(3);
  });
});

// ── barColor ────────────────────────────────────────────────────────────────

describe("barColor", () => {
  it.each([
    [0, "bg-error"],
    [1, "bg-error"],
    [2, "bg-warning"],
    [3, "bg-success"],
    [4, "bg-success"],
  ])("strength %i -> %s", (strength, expected) => {
    expect(barColor(strength)).toBe(expected);
  });
});

// ── labelColor ──────────────────────────────────────────────────────────────

describe("labelColor", () => {
  it.each([
    [0, "text-error"],
    [1, "text-error"],
    [2, "text-warning"],
    [3, "text-success"],
    [4, "text-success"],
  ])("strength %i -> %s", (strength, expected) => {
    expect(labelColor(strength)).toBe(expected);
  });
});
