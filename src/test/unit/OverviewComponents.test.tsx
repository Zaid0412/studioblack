// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { ProjectDetailsCard } from "@/app/(dashboard)/projects/[id]/_components/overview/ProjectDetailsCard";
import { ReviewBanner } from "@/app/(dashboard)/projects/[id]/_components/overview/ReviewBanner";
import type { DbProjectDetail } from "@/types";

afterEach(cleanup);

const PROJECT = {
  id: "p1",
  name: "Casa Belluno",
  client_name: "Belluno Family",
  client_email: "belluno@example.com",
  status: "active",
  category: "residential",
  deadline: "2026-09-01",
  scope: "Full villa",
  area_sqft: 4200,
  estimation_inr: 5000000,
  address: "12 Hill Rd",
  city: "Mumbai",
  state: "MH",
  created_at: "2026-01-10",
  members: [
    { user_id: "u1", name: "Priya PM", email: "priya@s.com", role: "pm" },
    {
      user_id: "u2",
      name: "Arun Arch",
      email: "arun@s.com",
      role: "architect",
    },
  ],
} as unknown as DbProjectDetail;

describe("ProjectDetailsCard", () => {
  it("shows client, team and estimate for the PM variant", () => {
    render(<ProjectDetailsCard project={PROJECT} variant="pm" />);
    expect(screen.getByText("Belluno Family")).toBeTruthy();
    expect(screen.getByText("Priya PM")).toBeTruthy();
    expect(screen.getByText("Arun Arch")).toBeTruthy();
    // Estimate is formatted with en-IN grouping.
    expect(screen.getByText("50,00,000")).toBeTruthy();
  });

  it("hides cost/estimate and internal fields for the client variant", () => {
    render(<ProjectDetailsCard project={PROJECT} variant="client" />);
    // Client-safe fields present.
    expect(screen.getByText("residential")).toBeTruthy();
    // Internal / cost fields must NOT leak.
    expect(screen.queryByText("50,00,000")).toBeNull();
    expect(screen.queryByText("Belluno Family")).toBeNull();
    expect(screen.queryByText("Priya PM")).toBeNull();
  });
});

describe("ReviewBanner", () => {
  it("renders nothing when there is nothing to review", () => {
    const { container } = render(<ReviewBanner count={0} href="/x" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the CTA when there are pending items", () => {
    render(<ReviewBanner count={3} href="/projects/p1/designs" />);
    expect(screen.getByText("reviewBannerCta")).toBeTruthy();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/projects/p1/designs");
  });
});
