// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { CategoryForm } from "@/components/elements/CategoryForm";
import type { CategoryOption } from "@/app/(dashboard)/elements/_lib/categoryUtils";

afterEach(cleanup);

const KITCHEN: CategoryOption = {
  id: "kit",
  label: "Kitchen",
  codePrefix: "KIT",
  depth: 0,
};
const CABINETS: CategoryOption = {
  id: "cab",
  label: "Kitchen › Cabinets",
  codePrefix: "KIT-CAB",
  depth: 1,
};

function renderForm(props: Partial<Parameters<typeof CategoryForm>[0]> = {}) {
  return render(
    <CategoryForm
      parentOptions={[KITCHEN]}
      submitting={false}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />
  );
}

describe("CategoryForm — parent field", () => {
  // The free form creates a Category (no parent) or a Sub-category (parent =
  // a Category). It must not be able to reach a Service Area.
  it("renders a parent picker when the parent is free", () => {
    renderForm();
    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  /**
   * The parent is fixed when creating from a row's `+`, and when editing —
   * where the API ignores `parent_id` entirely but still applies the rebased
   * `code_prefix`, so a dropdown here silently corrupted the code.
   */
  it("renders the parent as text, with no picker, when locked", () => {
    renderForm({ lockParent: true, fixedParent: CABINETS });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Kitchen › Cabinets")).toBeTruthy();
  });

  it("shows the 'no parent' label when locked to a root category", () => {
    renderForm({ lockParent: true, fixedParent: null });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("categoryParentNone")).toBeTruthy();
  });

  // The locked parent is the source of the code prefix — it isn't in
  // `parentOptions` (that list is Categories only), so it can't be looked up.
  it("composes the code onto the locked parent's prefix", () => {
    renderForm({
      lockParent: true,
      fixedParent: CABINETS,
      initial: { name: "Base Units", codePrefix: "KIT-CAB-BASE" },
    });

    // The form edits only the last segment; the full path is composed.
    expect(screen.getByDisplayValue("BASE")).toBeTruthy();
  });
});
