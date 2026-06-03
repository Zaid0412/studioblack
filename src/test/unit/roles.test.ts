import { describe, it, expect } from "vitest";
import { isStudioUser, isExternalViewer } from "@/lib/roles";
import type { UserRole } from "@/types";

describe("isStudioUser", () => {
  it("is true for studio-internal roles", () => {
    expect(isStudioUser("pm")).toBe(true);
    expect(isStudioUser("architect")).toBe(true);
  });

  it("is false for external roles", () => {
    expect(isStudioUser("client")).toBe(false);
    expect(isStudioUser("vendor")).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isStudioUser(null)).toBe(false);
    expect(isStudioUser(undefined)).toBe(false);
  });

  it("is the exact inverse of isExternalViewer for every known role", () => {
    const roles: UserRole[] = ["pm", "architect", "client", "vendor"];
    for (const role of roles) {
      expect(isStudioUser(role)).toBe(!isExternalViewer(role));
    }
  });
});
