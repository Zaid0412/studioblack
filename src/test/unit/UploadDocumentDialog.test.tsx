// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("@/components/ui/useToast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  projectDocuments: {
    getUploadUrl: vi.fn(),
    createDocument: vi.fn(),
  },
}));

import { UploadDocumentDialog } from "@/app/(dashboard)/projects/[id]/documents/_components/UploadDocumentDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/useToast";
import { projectDocuments } from "@/lib/api";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";

const PROJECT_ID = "proj-1";
const SECTION_ID = "11111111-1111-4111-8111-111111111111";

const sampleSection: DbProjectDocumentSection = {
  id: SECTION_ID,
  project_id: PROJECT_ID,
  name: "Minutes of Meeting",
  icon: "Folder",
  position: 0,
  created_by: "u-1",
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
  doc_count: 0,
};

function makeFile(name: string, size = 100, type = "application/pdf"): File {
  // jsdom's File ignores size from constructor; force the size getter for our cap checks.
  const f = new File(["x".repeat(Math.min(size, 1024))], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

function renderDialog(
  props: Partial<Parameters<typeof UploadDocumentDialog>[0]> = {}
) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: PROJECT_ID,
    sections: [sampleSection],
    initialSectionId: SECTION_ID,
    initialFiles: [makeFile("a.pdf"), makeFile("b.pdf")],
    onCreateSection: vi
      .fn()
      .mockResolvedValue(sampleSection) as unknown as (data: {
      name: string;
      icon: string;
    }) => Promise<DbProjectDocumentSection>,
    onSuccess: vi.fn(),
  };
  return render(
    <TooltipProvider>
      <UploadDocumentDialog {...defaults} {...props} />
    </TooltipProvider>
  );
}

describe("UploadDocumentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("seeds entries from initialFiles and shows them in the tab list", () => {
    renderDialog();
    expect(screen.getByText("a")).toBeDefined();
    expect(screen.getByText("b")).toBeDefined();
  });

  it("silently drops oversized initialFiles", () => {
    const big = makeFile("huge.pdf", 60 * 1024 * 1024); // 60MB, above 50MB cap
    renderDialog({ initialFiles: [big, makeFile("ok.pdf", 100)] });
    // Only the small file should land in the entry list. Toasting on
    // initial filter is the caller's responsibility; this test just
    // pins the dialog's defensive behaviour.
    expect(screen.queryByText("huge")).toBeNull();
    expect(screen.getByText("ok")).toBeDefined();
  });

  it("removes an entry and preserves selection by falling back to a sibling", () => {
    renderDialog({
      initialFiles: [makeFile("a.pdf"), makeFile("b.pdf"), makeFile("c.pdf")],
    });
    // 3 trash buttons (one per non-done file), in tab-list order.
    const trashButtons = screen.getAllByRole("button", {
      name: "Remove from batch",
    });
    expect(trashButtons).toHaveLength(3);
    // Remove the first file ("a").
    fireEvent.click(trashButtons[0]);
    expect(screen.queryByText("a")).toBeNull();
    // "b" should now be selected (first remaining entry) — its name still
    // shows in the detail pane's File-name input.
    const input = screen.getByDisplayValue("b") as HTMLInputElement;
    expect(input).toBeDefined();
  });

  it("disables the upload button when no section is picked", () => {
    renderDialog({ initialSectionId: null });
    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    expect((uploadBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls onSuccess with the created rows after a successful batch upload", async () => {
    const onSuccess = vi.fn();
    const createdA: DbProjectDocument = {
      id: "doc-a",
      project_id: PROJECT_ID,
      section_id: SECTION_ID,
      file_name: "a.pdf",
      file_size: 100,
      mime_type: "application/pdf",
      storage_path: `projects/${PROJECT_ID}/documents/a.pdf`,
      uploaded_by: "u-1",
      description: null,
      created_at: "2024-06-01T00:00:00Z",
    };
    const createdB = { ...createdA, id: "doc-b", file_name: "b.pdf" };

    vi.mocked(projectDocuments.getUploadUrl).mockImplementation(
      async (_pid, _sid, data) => ({
        signedUrl: `https://example.test/${data.fileName}`,
        storagePath: `projects/${PROJECT_ID}/documents/${data.fileName}`,
      })
    );
    vi.mocked(projectDocuments.createDocument).mockImplementation(
      async (_pid, _sid, data) =>
        data.fileName === "a.pdf" ? createdA : createdB
    );
    const realFetch = global.fetch;
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    renderDialog({ onSuccess });
    const uploadBtn = screen.getByRole("button", {
      name: /upload 2 files/i,
    });
    fireEvent.click(uploadBtn);
    // Drain microtasks until onSuccess fires (or we give up).
    for (let i = 0; i < 20 && onSuccess.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(onSuccess).toHaveBeenCalledTimes(1);
    const payload = onSuccess.mock.calls[0][0] as DbProjectDocument[];
    expect(payload.map((d) => d.id).sort()).toEqual(["doc-a", "doc-b"]);
    global.fetch = realFetch;
  });

  it("marks failed files with the error status on partial failure", async () => {
    vi.mocked(projectDocuments.getUploadUrl).mockImplementation(
      async (_pid, _sid, data) => ({
        signedUrl: `https://example.test/${data.fileName}`,
        storagePath: `projects/${PROJECT_ID}/documents/${data.fileName}`,
      })
    );
    // Second file's createDocument rejects.
    vi.mocked(projectDocuments.createDocument).mockImplementation(
      async (_pid, _sid, data) => {
        if (data.fileName === "b.pdf") throw new Error("nope");
        return {
          id: "doc-a",
          project_id: PROJECT_ID,
          section_id: SECTION_ID,
          file_name: "a.pdf",
          file_size: 100,
          mime_type: "application/pdf",
          storage_path: "x",
          uploaded_by: "u-1",
          description: null,
          created_at: "2024-06-01T00:00:00Z",
        } satisfies DbProjectDocument;
      }
    );
    const realFetch = global.fetch;
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /upload 2 files/i }));
    // Drain until the failure toast fires.
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
      const calls = vi.mocked(toast).mock.calls;
      if (calls.some((c) => /failed/i.test(String(c[0].title)))) break;
    }
    expect(
      vi
        .mocked(toast)
        .mock.calls.some((c) => /^1 file failed/i.test(String(c[0].title)))
    ).toBe(true);
    // Click the "b" tab so the failed entry's detail pane renders, then
    // assert the error message is visible there.
    fireEvent.click(screen.getByText("b"));
    const detail = screen.getByText("nope");
    expect(detail).toBeDefined();
    global.fetch = realFetch;
  });
});

// silence "no-unused-vars" for the within helper we don't always use
void within;
