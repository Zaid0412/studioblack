// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BarChart } from "@/components/ui/BarChart";

afterEach(cleanup);

describe("BarChart", () => {
  it("renders a row per bar with label and formatted value", () => {
    render(
      <BarChart
        bars={[
          { label: "Civil", value: 40 },
          { label: "MEP", value: 10 },
        ]}
        formatValue={(v) => `${v}L`}
      />
    );
    expect(screen.getByText("Civil")).toBeTruthy();
    expect(screen.getByText("MEP")).toBeTruthy();
    expect(screen.getByText("40L")).toBeTruthy();
    expect(screen.getByText("10L")).toBeTruthy();
  });

  it("scales fill width to the largest value by default", () => {
    const { container } = render(
      <BarChart
        bars={[
          { label: "A", value: 50 },
          { label: "B", value: 100 },
        ]}
      />
    );
    const fills = container.querySelectorAll("li > span:nth-child(2) > span");
    expect((fills[0] as HTMLElement).style.width).toBe("50%");
    expect((fills[1] as HTMLElement).style.width).toBe("100%");
  });

  it("uses an explicit max (percent scale) when given", () => {
    const { container } = render(
      <BarChart bars={[{ label: "2D Layout", value: 25 }]} max={100} />
    );
    const fill = container.querySelector(
      "li > span:nth-child(2) > span"
    ) as HTMLElement;
    expect(fill.style.width).toBe("25%");
  });

  it("renders the empty label when there are no bars", () => {
    render(<BarChart bars={[]} emptyLabel="Nothing yet" />);
    expect(screen.getByText("Nothing yet")).toBeTruthy();
  });
});
