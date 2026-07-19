// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DonutChart } from "@/components/ui/DonutChart";

afterEach(cleanup);

const SEGMENTS = [
  { label: "Approved", value: 7, color: "var(--success)" },
  { label: "Pending", value: 3, color: "var(--accent)" },
  { label: "Rejected", value: 2, color: "var(--error)" },
];

describe("DonutChart", () => {
  it("renders the legend with each label and value", () => {
    render(<DonutChart segments={SEGMENTS} />);
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Rejected")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("renders center value and label when provided", () => {
    render(
      <DonutChart segments={SEGMENTS} centerValue="12" centerLabel="Files" />
    );
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Files")).toBeTruthy();
  });

  it("builds a conic-gradient ring from the segments", () => {
    render(<DonutChart segments={SEGMENTS} />);
    const ring = screen.getByRole("img");
    expect(ring.style.background).toContain("conic-gradient");
    expect(ring.getAttribute("aria-label")).toContain("Approved: 7");
  });

  it("renders an empty ring when there is no data", () => {
    render(<DonutChart segments={[]} />);
    const ring = screen.getByRole("img");
    expect(ring.getAttribute("aria-label")).toBe("No data");
    expect(ring.style.background).toContain("var(--border)");
  });

  it("hides the legend when legend={false}", () => {
    render(<DonutChart segments={SEGMENTS} legend={false} />);
    expect(screen.queryByText("Approved")).toBeNull();
  });
});
