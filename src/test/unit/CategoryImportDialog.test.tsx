// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

// jsdom has no ResizeObserver; the Tabs sliding indicator observes its list.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}));
vi.mock("@/components/ui/useToast", () => ({ toast: vi.fn() }));
// Default `useSWR` too — the dialog now reads the coding config via useCodeConfig
// (which falls back to defaults when data is undefined).
vi.mock("swr", () => ({
  default: () => ({ data: undefined, isLoading: false, mutate: vi.fn() }),
  mutate: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  elementCategories: {
    validateImport: vi.fn(),
    confirmImport: vi.fn(),
    downloadImportTemplate: () => "/api/element-categories/import/template",
  },
}));

import { CategoryImportDialog } from "@/app/(dashboard)/categories/_components/CategoryImportDialog";
import { elementCategories as categoriesApi } from "@/lib/api";
import type {
  CategoryImportDelete,
  CategoryPath,
} from "@/lib/queries/categoryImport";

const noRefs = {
  elements: 0,
  vendorTrades: 0,
  boqItems: 0,
  rfqItems: 0,
  rateContracts: 0,
  rateContractItems: 0,
};

/** A parsed row is one leaf chain. */
const row = (path: CategoryPath) => ({
  rowNumber: 1,
  excelRowNumber: 2,
  raw: {},
  parsed: { rowNumber: 1, path },
  status: "valid" as const,
  errors: [],
  warnings: [],
});

const KITCHEN: CategoryPath = [
  { name: "Kitchen", codePrefix: "KIT" },
  { name: "Cabinets", codePrefix: "KIT-CAB" },
  { name: "Base Units", codePrefix: "KIT-CAB-BASE" },
];

/** Same chain, but with no codes — the sheet left the code cells blank. */
const KITCHEN_NO_CODES: CategoryPath = [
  { name: "Kitchen", codePrefix: null },
  { name: "Cabinets", codePrefix: null },
  { name: "Base Units", codePrefix: null },
];

function previewResponse({
  rows = [row(KITCHEN)],
  plan,
}: {
  rows?: ReturnType<typeof row>[];
  plan: {
    creates?: unknown[];
    updates?: unknown[];
    deletes?: CategoryImportDelete[];
    blocked?: CategoryImportDelete[];
  };
}) {
  return {
    headers: [],
    unknownColumns: [],
    missingColumns: [],
    duplicateColumns: [],
    rows,
    totalRows: rows.length,
    plan: {
      creates: plan.creates ?? [],
      updates: plan.updates ?? [],
      deletes: plan.deletes ?? [],
      blocked: plan.blocked ?? [],
    },
  };
}

/** Radix Tabs activate on focus, and jsdom's click doesn't focus. */
function gotoTab(name: RegExp) {
  fireEvent.focus(screen.getByRole("tab", { name }));
}

/** Render, drop a file in, and wait for `awaited` to appear. */
async function upload(response: unknown, awaited: string) {
  vi.mocked(categoriesApi.validateImport).mockResolvedValue(response as never);
  render(<CategoryImportDialog open onOpenChange={() => {}} />);
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File(["x"], "categories.csv", { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText(awaited);
}

describe("CategoryImportDialog", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows the no-changes state when the sheet matches", async () => {
    await upload(previewResponse({ plan: {} }), "categoryImportNoChangesTitle");

    expect(screen.getByText("categoryImportNoChangesTitle")).toBeDefined();
  });

  it("recomposes a create's code live as the segment is edited", async () => {
    await upload(
      previewResponse({
        plan: {
          creates: [
            {
              path: ["Kitchen", "Cabinets", "Base Units"],
              codePrefix: "KIT-CAB-BASE",
              level: 3,
            },
          ],
        },
      }),
      "KIT-CAB-BASE"
    );

    expect(screen.getByText("KIT-CAB-BASE")).toBeDefined();

    const code = screen.getByLabelText("categoryImportCodeLabel");
    fireEvent.change(code, { target: { value: "BSE" } });

    // Composed onto the parent it was parsed under.
    expect(screen.getByText("KIT-CAB-BSE")).toBeDefined();
  });

  it("auto-generates codes for rows that left the code blank", async () => {
    // Blank codes + auto-generate (the mocked config default) → the preview
    // shows codes abbreviated from the names (Base Units → BASE, cap 4).
    await upload(
      previewResponse({
        rows: [row(KITCHEN_NO_CODES)],
        plan: {
          creates: [
            {
              path: ["Kitchen", "Cabinets", "Base Units"],
              codePrefix: null,
              level: 3,
            },
          ],
        },
      }),
      "KITC-CABI-BASE"
    );

    expect(screen.getByText("KITC-CABI-BASE")).toBeDefined();
  });

  it("flags a code that composes past the length cap and blocks import", async () => {
    await upload(
      previewResponse({
        plan: {
          creates: [
            {
              path: ["Kitchen", "Cabinets", "Base Units"],
              codePrefix: "KIT-CAB-BASE",
              level: 3,
            },
          ],
        },
      }),
      "KIT-CAB-BASE"
    );

    const code = screen.getByLabelText("categoryImportCodeLabel");
    fireEvent.change(code, { target: { value: "WAYTOOLONGSEGMENT" } });

    expect(screen.getByText(/categoryImportCodeTooLong/)).toBeDefined();
    const importBtn = screen.getByRole("button", {
      name: "categoryImportConfirmCount",
    });
    expect((importBtn as HTMLButtonElement).disabled).toBe(true);
  });

  // A referenced removal can't be dropped: locked kept, and it doesn't block the
  // rest of the import.
  it("locks a blocked removal as kept, and still allows import", async () => {
    const blocked: CategoryImportDelete = {
      id: "old",
      path: ["Legacy", "Thing"],
      chain: [
        { name: "Legacy", codePrefix: "LEG" },
        { name: "Thing", codePrefix: "LEG-THG" },
      ],
      references: { ...noRefs, elements: 3 },
    };
    await upload(
      previewResponse({
        rows: [row(KITCHEN)],
        plan: {
          creates: [
            {
              path: ["Kitchen", "Cabinets", "Base Units"],
              codePrefix: "KIT-CAB-BASE",
              level: 3,
            },
          ],
          deletes: [blocked],
          blocked: [blocked],
        },
      }),
      "categoryImportConfirmCount"
    );

    gotoTab(/categoryImportDeleted/);
    expect(await screen.findByText("categoryImportKeptLocked")).toBeDefined();

    // Import is still available — the blocked one is simply kept.
    const importBtn = screen.getByRole("button", {
      name: "categoryImportConfirmCount",
    });
    expect((importBtn as HTMLButtonElement).disabled).toBe(false);
  });

  /**
   * Keeping a removal adds its chain back to what's sent, so the server sees it
   * as wanted and doesn't delete it.
   */
  it("sends a kept removal back in the confirmed paths", async () => {
    const removable: CategoryImportDelete = {
      id: "corner",
      path: ["Kitchen", "Cabinets", "Corner Units"],
      chain: [
        { name: "Kitchen", codePrefix: "KIT" },
        { name: "Cabinets", codePrefix: "KIT-CAB" },
        { name: "Corner Units", codePrefix: "KIT-CAB-COR" },
      ],
      references: { ...noRefs },
    };
    vi.mocked(categoriesApi.confirmImport).mockResolvedValue({
      created: 0,
      updated: 0,
      deleted: 0,
    });
    await upload(
      previewResponse({
        rows: [row(KITCHEN)],
        plan: {
          // A create keeps the import non-empty after the removal is kept.
          creates: [
            {
              path: ["Kitchen", "Cabinets", "Base Units"],
              codePrefix: "KIT-CAB-BASE",
              level: 3,
            },
          ],
          deletes: [removable],
        },
      }),
      "categoryImportConfirmCount"
    );

    gotoTab(/categoryImportDeleted/);
    // Tick "Keep".
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "categoryImportConfirmCount" })
    );

    const sent = vi.mocked(categoriesApi.confirmImport).mock.calls[0][0];
    // The kept chain is sent alongside the sheet's own row.
    const hasCorner = sent.some(
      (p) => p[p.length - 1]?.name === "Corner Units"
    );
    expect(hasCorner).toBe(true);
  });
});
