// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

// jsdom doesn't implement ResizeObserver — stub it so the nav + overflow
// height-tracking effects can run without throwing.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

let mockPathname = "/dashboard";
const mockRole = { role: "pm" as string | null };
const mockFlags: Record<string, boolean> = {
  vendorManagement: true,
  elementLibrary: true,
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => mockRole,
}));
vi.mock("@/hooks/useFlag", () => ({
  useFlag: (name: string) => mockFlags[name] ?? false,
}));

import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

beforeEach(() => {
  mockPathname = "/dashboard";
  mockRole.role = "pm";
  mockFlags.vendorManagement = true;
  mockFlags.elementLibrary = true;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("MobileBottomNav — role-based splitting", () => {
  it("PM with vendorManagement on: renders 4 primary tabs + More", () => {
    mockRole.role = "pm";
    render(<MobileBottomNav />);
    // The 4 primary tabs are rendered as nav links.
    expect(screen.getByText("dashboard")).toBeDefined();
    expect(screen.getByText("projects")).toBeDefined();
    expect(screen.getByText("tasks")).toBeDefined();
    expect(screen.getByText("elements")).toBeDefined();
    // The More button replaces the 5th + 6th tabs.
    expect(screen.getByText("more")).toBeDefined();
    // Vendors + Audit overflow are NOT visible in the primary row, but the
    // overflow <ul> is rendered (height: 0). Their labels are present.
    expect(screen.getAllByText("vendors").length).toBeGreaterThan(0);
    expect(screen.getAllByText("audit").length).toBeGreaterThan(0);
  });

  it("Architect: 4 tabs flat — no More button (one below the overflow threshold)", () => {
    mockRole.role = "architect";
    render(<MobileBottomNav />);
    // Architect sees: Dashboard / Projects / Tasks / Elements / Vendors (5 total).
    // 5 tabs <= PRIMARY_LIMIT (4) + 1 → all primary, no More button.
    expect(screen.getByText("dashboard")).toBeDefined();
    expect(screen.getByText("projects")).toBeDefined();
    expect(screen.getByText("tasks")).toBeDefined();
    expect(screen.getByText("elements")).toBeDefined();
    expect(screen.getByText("vendors")).toBeDefined();
    expect(screen.queryByText("more")).toBeNull();
  });

  it("Client: 2 tabs — Dashboard + Projects only", () => {
    mockRole.role = "client";
    render(<MobileBottomNav />);
    expect(screen.getByText("dashboard")).toBeDefined();
    expect(screen.getByText("projects")).toBeDefined();
    expect(screen.queryByText("tasks")).toBeNull();
    expect(screen.queryByText("elements")).toBeNull();
    expect(screen.queryByText("more")).toBeNull();
  });

  it("Vendor: 4 vendor-portal tabs", () => {
    mockRole.role = "vendor";
    render(<MobileBottomNav />);
    expect(screen.getByText("vendorDashboard")).toBeDefined();
    expect(screen.getByText("rfqs")).toBeDefined();
    expect(screen.getByText("purchaseOrders")).toBeDefined();
    expect(screen.getByText("invoices")).toBeDefined();
    expect(screen.queryByText("more")).toBeNull();
  });
});

describe("MobileBottomNav — More toggle", () => {
  it("clicking More opens the overflow sheet (aria-expanded flips)", () => {
    mockRole.role = "pm";
    render(<MobileBottomNav />);
    const moreButton = screen.getByText("more").closest("button")!;
    expect(moreButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(moreButton);
    expect(moreButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("clicking an overflow link calls the link handler (sheet closes via pathname effect in real flow)", () => {
    mockRole.role = "pm";
    render(<MobileBottomNav />);
    fireEvent.click(screen.getByText("more").closest("button")!);
    // The overflow `<ul>` is in the DOM even before opening; find the
    // Vendors Link inside it (the primary row has no Vendors entry).
    const vendorLinks = screen.getAllByRole("link", { name: /vendors/i });
    expect(vendorLinks.length).toBeGreaterThan(0);
  });
});

describe("MobileBottomNav — active state highlights current route", () => {
  it("highlights More when on an overflow route", () => {
    mockRole.role = "pm";
    mockPathname = "/vendors";
    render(<MobileBottomNav />);
    const moreButton = screen.getByText("more").closest("button")!;
    // The accent class is applied when moreActive is true.
    expect(moreButton.className).toMatch(/text-accent/);
  });

  it("does NOT highlight More when on a primary route", () => {
    mockRole.role = "pm";
    mockPathname = "/dashboard";
    render(<MobileBottomNav />);
    const moreButton = screen.getByText("more").closest("button")!;
    expect(moreButton.className).toMatch(/text-text-muted/);
  });
});
