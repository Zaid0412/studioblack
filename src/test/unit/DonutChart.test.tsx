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

  it("hides the legend when legend={false}", () => {
    render(<DonutChart segments={SEGMENTS} legend={false} />);
    expect(screen.queryByText("Approved")).toBeNull();
  });

  it("renders without crashing when there is no data", () => {
    const { container } = render(<DonutChart segments={[]} />);
    expect(container.querySelector(".donut-chart")).toBeTruthy();
  });
});
