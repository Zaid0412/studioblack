// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const codeConfig = {
  auto_generate: true,
  code_max_length: 4,
  force_uppercase: true,
  prevent_duplicates: true,
  lock_after_use: true,
};
vi.mock("@/hooks/useCodeConfig", () => ({
  useCodeConfig: () => ({
    config: codeConfig,
    isLoading: false,
    loaded: true,
    mutate: vi.fn(),
  }),
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
  it("renders the parent as a disabled input, with no picker, when locked", () => {
    renderForm({ fixedParent: { parent: CABINETS } });

    expect(screen.queryByRole("combobox")).toBeNull();
    const parent = screen.getByDisplayValue("Kitchen › Cabinets");
    expect((parent as HTMLInputElement).disabled).toBe(true);
  });

  // `{ parent: null }` is "locked to no parent" (editing a root Category) —
  // distinct from `undefined`, which is "the user may choose".
  it("shows the 'no parent' label when locked to a root category", () => {
    renderForm({ fixedParent: { parent: null } });

    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByDisplayValue("categoryParentNone")).toBeTruthy();
  });

  // The locked parent is the source of the code prefix — it isn't in
  // `parentOptions` (that list is Categories only), so it can't be looked up.
  it("composes the code onto the locked parent's prefix", () => {
    renderForm({
      fixedParent: { parent: CABINETS },
      initial: { name: "Base Units", codePrefix: "KIT-CAB-BASE" },
    });

    // The form edits only the last segment; the full path is composed.
    expect(screen.getByDisplayValue("BASE")).toBeTruthy();
  });
});

describe("CategoryForm — code auto-generation", () => {
  it("auto-fills the code from the name while creating (auto on)", () => {
    // Creating with a name and no code — the segment is suggested from the name.
    renderForm({ initial: { name: "Kitchen" } });
    expect(screen.getByDisplayValue("KITC")).toBeTruthy();
  });

  it("locks the code field when editing an in-use category", () => {
    renderForm({
      isEditing: true,
      inUse: true,
      initial: { name: "Kitchen", codePrefix: "KIT" },
    });
    const code = screen.getByDisplayValue("KIT") as HTMLInputElement;
    expect(code.disabled).toBe(true);
  });

  it("does not lock the code when the category isn't in use", () => {
    renderForm({
      isEditing: true,
      inUse: false,
      initial: { name: "Kitchen", codePrefix: "KIT" },
    });
    const code = screen.getByDisplayValue("KIT") as HTMLInputElement;
    expect(code.disabled).toBe(false);
  });
});
