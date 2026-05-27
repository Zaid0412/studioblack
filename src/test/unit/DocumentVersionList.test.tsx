// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import type { DbProjectDocument } from "@/types";

// Component-under-test depends on SWR + the document-preview hook. We mock
// both so the test can control the versions list synchronously and skip the
// real FilePreview / signed-URL fetch.
const swrData = new Map<string, unknown>();
vi.mock("swr", async () => {
  const actual = await vi.importActual<typeof import("swr")>("swr");
  return {
    ...actual,
    default: (key: unknown) => ({
      data: typeof key === "string" ? swrData.get(key) : undefined,
      mutate: vi.fn().mockResolvedValue(swrData.get(String(key))),
    }),
  };
});

vi.mock("@/components/ui/useToast", () => ({ toast: vi.fn() }));

vi.mock("@/hooks/useProjectDocumentPreview", () => ({
  useProjectDocumentPreview: () => ({
    previewable: false,
    previewUrl: undefined,
    refreshUrl: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  projectDocuments: {
    getDownloadUrl: vi.fn(),
    revertToVersion: vi.fn(),
    deleteVersion: vi.fn(),
  },
}));

vi.mock("@/lib/api/projectDocuments", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/projectDocuments")
  >("@/lib/api/projectDocuments");
  return { ...actual, withSignedUrl: vi.fn() };
});

// scrollIntoView isn't in jsdom; stub so jumpToVersion doesn't throw.
Element.prototype.scrollIntoView = vi.fn();

import { DocumentVersionList } from "@/app/(dashboard)/projects/[id]/documents/_components/DocumentVersionList";

const PROJECT_ID = "proj-1";
const DOC_ID = "doc-1";
const GROUP_ID = "vg-1";

function makeVersion(
  version: number,
  overrides: Partial<DbProjectDocument> = {}
): DbProjectDocument {
  return {
    id: `v-${version}`,
    project_id: PROJECT_ID,
    section_id: "sec-1",
    file_name: `file-v${version}.pdf`,
    file_size: 1234,
    mime_type: "application/pdf",
    storage_path: `projects/${PROJECT_ID}/documents/v${version}.pdf`,
    uploaded_by: "u-1",
    uploaded_by_name: "Alice",
    description: null,
    version,
    version_group: GROUP_ID,
    created_at: "2024-06-01T00:00:00Z",
    ...overrides,
  };
}

function seedVersions(versions: DbProjectDocument[]) {
  swrData.set(
    `/api/projects/${PROJECT_ID}/documents/${DOC_ID}/versions`,
    versions
  );
}

function renderList() {
  const doc = swrData.get(
    `/api/projects/${PROJECT_ID}/documents/${DOC_ID}/versions`
  ) as DbProjectDocument[];
  const latest = doc.reduce((a, b) => (a.version > b.version ? a : b));
  return render(
    <DocumentVersionList
      projectId={PROJECT_ID}
      doc={{ ...latest, id: DOC_ID }}
      canEdit={true}
      onUploadNewVersion={vi.fn()}
      onLatestChanged={vi.fn()}
    />
  );
}

beforeEach(() => {
  swrData.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

// ─── Revert detection ─────────────────────────────────────────────────────

describe("DocumentVersionList — revert detection", () => {
  it("labels a row as a revert when its storage_path appeared earlier in the group", () => {
    const v1 = makeVersion(1);
    const v2 = makeVersion(2);
    // V3 reuses V2's storage_path → this is a revert event
    const v3 = makeVersion(3, { storage_path: v2.storage_path });
    const v4 = makeVersion(4);
    seedVersions([v1, v2, v3, v4]);

    renderList();

    // The revert verb is unique to revert rows.
    expect(screen.getByText("reverted to V2")).toBeDefined();
    // The "Copy of V{n}" note is rendered as a clickable button.
    expect(screen.getByRole("button", { name: /Copy of V2/i })).toBeDefined();
  });

  it("labels a fresh-upload row as 'uploaded' (not a revert)", () => {
    const v1 = makeVersion(1);
    const v2 = makeVersion(2); // unique storage_path
    seedVersions([v1, v2]);
    renderList();
    // Both rows should read "uploaded" — neither reused an older path.
    expect(screen.getAllByText("uploaded")).toHaveLength(2);
    expect(screen.queryByText(/reverted to/i)).toBeNull();
  });
});

// ─── Latest-vs-historical UI shape ────────────────────────────────────────

describe("DocumentVersionList — latest is not expandable", () => {
  it("renders the latest row's filename inside a non-button container", () => {
    const v1 = makeVersion(1);
    const v2 = makeVersion(2);
    seedVersions([v1, v2]);
    renderList();
    // The non-latest row's file pill is rendered as <button aria-expanded>
    // and contains its filename. The latest row's pill is a <div>, so
    // querying by role=button with name=filename returns exactly one.
    const expandable = screen.getAllByRole("button", { expanded: false });
    const pillForV1 = expandable.find((b) =>
      b.textContent?.includes(v1.file_name)
    );
    const pillForV2 = expandable.find((b) =>
      b.textContent?.includes(v2.file_name)
    );
    expect(pillForV1).toBeDefined();
    expect(pillForV2).toBeUndefined();
  });
});

// ─── Expand to view details ───────────────────────────────────────────────

describe("DocumentVersionList — expand a non-latest row", () => {
  it("reveals the version's description after clicking its file pill", () => {
    const v1 = makeVersion(1, { description: "First draft." });
    const v2 = makeVersion(2);
    seedVersions([v1, v2]);
    renderList();
    expect(screen.queryByText("First draft.")).toBeNull();
    // Find the V1 file pill specifically (the only expandable button whose
    // text includes the V1 filename).
    const v1Pill = screen
      .getAllByRole("button", { expanded: false })
      .find((b) => b.textContent?.includes(v1.file_name))!;
    fireEvent.click(v1Pill);
    expect(screen.getByText("First draft.")).toBeDefined();
  });
});

// ─── Click-to-jump from revert info note ──────────────────────────────────

describe("DocumentVersionList — jump-to-version", () => {
  it("scrolls the linked-to version into view when the revert note is clicked", () => {
    const v1 = makeVersion(1);
    const v2 = makeVersion(2);
    const v3 = makeVersion(3, { storage_path: v2.storage_path }); // revert to V2
    seedVersions([v1, v2, v3]);
    renderList();

    fireEvent.click(screen.getByRole("button", { name: /Copy of V2/i }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });
});
