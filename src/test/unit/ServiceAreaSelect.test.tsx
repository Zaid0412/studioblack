// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  fireEvent,
  screen,
  cleanup,
  within,
} from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { ServiceAreaSelect } from "@/components/elements/ServiceAreaSelect";
import { CATEGORY_TREE as TREE } from "@/test/fixtures/categoryTree";

function open() {
  fireEvent.click(
    screen.getByRole("button", { name: /serviceAreaPlaceholder/ })
  );
}

const search = () => screen.getByPlaceholderText("search");

function renderSelect(
  props: Partial<React.ComponentProps<typeof ServiceAreaSelect>> = {}
) {
  const onChange = vi.fn();
  render(
    <ServiceAreaSelect
      value={null}
      onChange={onChange}
      tree={TREE}
      {...props}
    />
  );
  return onChange;
}

describe("ServiceAreaSelect", () => {
  afterEach(cleanup);

  it("opens at the Category level — nothing deeper is on screen", () => {
    renderSelect();
    open();

    expect(screen.getByText("Kitchen")).toBeDefined();
    expect(screen.getByText("Joinery")).toBeDefined();
    // Sub-categories and leaves are behind a drill, not merely greyed out.
    expect(screen.queryByText("Cabinets")).toBeNull();
    expect(screen.queryByText("Wall Units")).toBeNull();
  });

  it("drills without selecting — only a Service Area commits", () => {
    const onChange = renderSelect();
    open();

    fireEvent.click(screen.getByText("Kitchen"));
    expect(screen.getByText("Cabinets")).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Cabinets"));
    expect(screen.getByText("Wall Units")).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Base Units"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("base");
    // Committing closes the popover.
    expect(screen.queryByText("Wall Units")).toBeNull();
  });

  it("climbs back out through the breadcrumb", () => {
    renderSelect();
    open();
    fireEvent.click(screen.getByText("Kitchen"));
    fireEvent.click(screen.getByText("Cabinets"));

    const crumbs = screen.getByRole("navigation", {
      name: "serviceAreaBreadcrumbLabel",
    });

    // The crumb you're standing on is inert; the ones above it are buttons.
    fireEvent.click(within(crumbs).getByRole("button", { name: "Kitchen" }));
    expect(screen.getByText("Countertops")).toBeDefined();
    expect(screen.queryByText("Wall Units")).toBeNull();

    fireEvent.click(
      within(crumbs).getByRole("button", { name: "allCategories" })
    );
    expect(screen.getByText("Joinery")).toBeDefined();
    expect(screen.queryByText("Countertops")).toBeNull();
  });

  it("searches every leaf by path, and disambiguates same-named leaves", () => {
    const onChange = renderSelect();
    open();
    fireEvent.change(search(), { target: { value: "base units" } });

    // Both "Base Units" leaves surface, each carrying its full path.
    expect(screen.getByText("Kitchen › Cabinets › Base Units")).toBeDefined();
    expect(screen.getByText("Joinery › Furniture › Base Units")).toBeDefined();
    // The breadcrumb is meaningless in search mode, so it's hidden.
    expect(
      screen.queryByRole("navigation", { name: "serviceAreaBreadcrumbLabel" })
    ).toBeNull();

    fireEvent.click(screen.getByText("Joinery › Furniture › Base Units"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("jbase");
  });

  it("matches on the path, so an ancestor's name finds a leaf", () => {
    renderSelect();
    open();
    fireEvent.change(search(), { target: { value: "joinery" } });

    // Only leaves — "Joinery" and "Furniture" themselves are never offered.
    expect(screen.getByText("Joinery › Furniture › Base Units")).toBeDefined();
    expect(screen.queryByText("Kitchen › Cabinets › Base Units")).toBeNull();
  });

  it("restores the drill cursor when the query is cleared", () => {
    renderSelect();
    open();
    fireEvent.click(screen.getByText("Kitchen"));
    fireEvent.change(search(), { target: { value: "base" } });
    fireEvent.change(search(), { target: { value: "" } });

    // Back where we left off — Kitchen's sub-categories, not the root.
    expect(screen.getByText("Cabinets")).toBeDefined();
    expect(screen.queryByText("Joinery")).toBeNull();
  });

  it("leads the trigger with the Service Area, ancestors clipping first", () => {
    renderSelect({ value: "base" });

    // The whole path still reads as one string — that's the sr-only span, and
    // it's why splitting the label visually didn't wreck the accessible name.
    const trigger = screen.getByRole("button", {
      name: /Kitchen › Cabinets › Base Units/,
    });

    // jsdom has no layout, so clipping priority can only be pinned structurally:
    // the leaf is its own element and holds its width, while the ancestors are
    // the ones carrying `truncate`.
    expect(within(trigger).getByText("Base Units").className).toContain(
      "shrink-0"
    );
    expect(
      within(trigger).getByText(/^Kitchen › Cabinets ›$/).className
    ).toContain("truncate");
  });

  it("opens on the current value's siblings, with it selected", () => {
    renderSelect({ value: "base" });

    fireEvent.click(
      screen.getByRole("button", { name: /Kitchen › Cabinets › Base Units/ })
    );

    // Straight to the leaf list — no drilling to change your mind.
    expect(screen.getByText("Wall Units")).toBeDefined();
    expect(screen.queryByText("Joinery")).toBeNull();
  });

  it("renders a grandfathered Category value and opens on its children", () => {
    renderSelect({ value: "kit" });

    // A value too shallow to be valid still displays — it isn't silently blank.
    const trigger = screen.getByRole("button", { name: /Kitchen/ });
    fireEvent.click(trigger);

    // Lands on exactly the list it must be replaced from.
    expect(screen.getByText("Cabinets")).toBeDefined();
    expect(screen.getByText("Countertops")).toBeDefined();
  });

  it("says a branch is empty rather than showing a blank box", () => {
    renderSelect();
    open();
    fireEvent.click(screen.getByText("Kitchen"));
    fireEvent.click(screen.getByText("Countertops"));

    expect(screen.getByText("serviceAreaNoServiceAreas")).toBeDefined();
    // And the breadcrumb survives, so the dead end is escapable.
    expect(
      screen.getByRole("navigation", { name: "serviceAreaBreadcrumbLabel" })
    ).toBeDefined();
  });

  // Every host requires a Service Area, so there is no reset row to offer.
  it("never offers a way back to no value", () => {
    renderSelect({ value: "base" });
    fireEvent.click(
      screen.getByRole("button", { name: /Kitchen › Cabinets › Base Units/ })
    );

    expect(screen.queryByText("uncategorized")).toBeNull();
  });
});
