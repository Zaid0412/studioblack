import { describe, it, expect } from "vitest";
import { isActiveRoute } from "@/lib/nav";

describe("isActiveRoute", () => {
  it("returns true when pathname equals href", () => {
    expect(isActiveRoute("/projects", "/projects")).toBe(true);
    expect(isActiveRoute("/dashboard", "/dashboard")).toBe(true);
  });

  it("returns true for sub-routes of a non-dashboard href", () => {
    expect(isActiveRoute("/projects/abc-123", "/projects")).toBe(true);
    expect(isActiveRoute("/projects/abc-123/boq", "/projects")).toBe(true);
    expect(isActiveRoute("/tasks/42", "/tasks")).toBe(true);
  });

  it("returns false for sub-routes of /dashboard — every dashboard sub-route lives under another tab", () => {
    expect(isActiveRoute("/dashboard/anything", "/dashboard")).toBe(false);
  });

  it("returns false for sub-routes of /vendor-portal — same reason as /dashboard", () => {
    expect(isActiveRoute("/vendor-portal/rfqs", "/vendor-portal")).toBe(false);
    expect(isActiveRoute("/vendor-portal/invoices/12", "/vendor-portal")).toBe(
      false
    );
  });

  it("returns false for pathnames that prefix-collide without a slash boundary", () => {
    // `/projectsfoo` is NOT a sub-route of `/projects`.
    expect(isActiveRoute("/projectsfoo", "/projects")).toBe(false);
    expect(isActiveRoute("/tasks-archive", "/tasks")).toBe(false);
  });

  it("returns false for unrelated routes", () => {
    expect(isActiveRoute("/tasks", "/projects")).toBe(false);
    expect(isActiveRoute("/", "/projects")).toBe(false);
  });
});
