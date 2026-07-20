// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BarChart } from "@/components/ui/BarChart";

afterEach(cleanup);

describe("BarChart", () => {
  it("renders the empty label when there are no bars", () => {
    render(<BarChart bars={[]} emptyLabel="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });

  it("renders a chart container when given bars", () => {
    const { container } = render(
      <BarChart
        bars={[
          { label: "Civil", value: 40 },
          { label: "MEP", value: 10 },
        ]}
        formatValue={(v) => `${v}L`}
      />
    );
    // recharts mounts into a ResponsiveContainer; jsdom has no layout, so bar
    // geometry isn't measurable — this is a mount smoke test.
    expect(
      container.querySelector(".recharts-responsive-container")
    ).toBeTruthy();
  });
});
