import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listDocumentSections,
  createDocumentSection,
  getDocumentSectionById,
  updateDocumentSection,
  deleteDocumentSection,
  listSectionDocuments,
  listProjectDocuments,
  createDocument,
  createDocumentVersion,
  deleteDocumentVersion,
  getDocumentById,
  getDocumentVersionHistory,
  getLatestVersionForDocument,
  revertDocumentToVersion,
  updateDocument,
  deleteDocument,
} from "@/lib/queries";
import {
  GET as GET_SECTIONS,
  POST as POST_SECTIONS,
} from "@/app/api/projects/[id]/document-sections/route";
import {
  PATCH as PATCH_SECTION,
  DELETE as DELETE_SECTION,
} from "@/app/api/projects/[id]/document-sections/[sectionId]/route";
import {
  GET as GET_DOCS,
  POST as POST_DOC,
} from "@/app/api/projects/[id]/document-sections/[sectionId]/documents/route";
import { GET as GET_ALL_DOCS } from "@/app/api/projects/[id]/documents/route";
import { POST as POST_UPLOAD_URL } from "@/app/api/projects/[id]/document-sections/[sectionId]/documents/upload-url/route";
import {
  DELETE as DELETE_DOC,
  PATCH as PATCH_DOC,
} from "@/app/api/projects/[id]/documents/[documentId]/route";
import { GET as GET_DOWNLOAD } from "@/app/api/projects/[id]/documents/[documentId]/download/route";
import {
  GET as GET_VERSIONS,
  POST as POST_VERSION,
} from "@/app/api/projects/[id]/documents/[documentId]/versions/route";
import { POST as POST_VERSION_UPLOAD_URL } from "@/app/api/projects/[id]/documents/[documentId]/versions/upload-url/route";
import { DELETE as DELETE_VERSION } from "@/app/api/projects/[id]/documents/[documentId]/versions/[versionId]/route";
import { POST as POST_REVERT } from "@/app/api/projects/[id]/documents/[documentId]/revert/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "proj-1";
const SECTION_ID = "sec-1";
const DOC_ID = "doc-1";

const basePath = `/api/projects/${PROJECT_ID}/document-sections`;
const sectionPath = `${basePath}/${SECTION_ID}`;
const docsPath = `${sectionPath}/documents`;
const uploadUrlPath = `${docsPath}/upload-url`;
const docPath = `/api/projects/${PROJECT_ID}/documents/${DOC_ID}`;
const downloadPath = `${docPath}/download`;

const baseParams = { id: PROJECT_ID };
const sectionParams = { id: PROJECT_ID, sectionId: SECTION_ID };
const docParams = { id: PROJECT_ID, documentId: DOC_ID };

const sampleSection = {
  id: SECTION_ID,
  project_id: PROJECT_ID,
  name: "Minutes of Meeting",
  icon: "folder",
  position: 0,
  created_by: TEST_USER_ID,
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
  doc_count: 0,
};

const sampleDoc = {
  id: DOC_ID,
  project_id: PROJECT_ID,
  section_id: SECTION_ID,
  file_name: "kickoff.pdf",
  file_size: 1234,
  mime_type: "application/pdf",
  storage_path: `projects/${PROJECT_ID}/documents/abc-kickoff.pdf`,
  uploaded_by: TEST_USER_ID,
  uploaded_by_name: "Test PM",
  description: null,
  version: 1,
  version_group: "vg-1",
  created_at: "2024-06-01T00:00:00Z",
};

/** Common PATCH setup: doc exists and is the latest version. */
function mockPatchPreconditions(doc = sampleDoc) {
  vi.mocked(getDocumentById).mockResolvedValue(doc as never);
  vi.mocked(getLatestVersionForDocument).mockResolvedValue({
    versionGroup: doc.version_group,
    latestVersion: doc.version,
  });
}

// ── GET sections ────────────────────────────────────────────────────────────

describe("GET .../document-sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the section list", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(listDocumentSections).mockResolvedValue([sampleSection] as never);

    const res = await GET_SECTIONS(
      buildRequest(basePath),
      buildParams(baseParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toEqual([sampleSection]);
    expect(listDocumentSections).toHaveBeenCalledWith(PROJECT_ID, TEST_USER_ID);
  });

  it("returns 401 without a session", async () => {
    setupAuth(mocks.auth, null);
    const res = await GET_SECTIONS(
      buildRequest(basePath),
      buildParams(baseParams)
    );
    expect((await parseResponse(res)).status).toBe(401);
  });
});

// ── POST sections ───────────────────────────────────────────────────────────

describe("POST .../document-sections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a section with name + icon", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(createDocumentSection).mockResolvedValue(sampleSection as never);

    const res = await POST_SECTIONS(
      buildRequest(basePath, {
        method: "POST",
        body: { name: "Site Visits", icon: "Image" },
      }),
      buildParams(baseParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body).toEqual(sampleSection);
    expect(createDocumentSection).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Site Visits", icon: "Image" })
    );
  });

  it("defaults icon to 'folder' when not supplied", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(createDocumentSection).mockResolvedValue(sampleSection as never);

    await POST_SECTIONS(
      buildRequest(basePath, {
        method: "POST",
        body: { name: "Other" },
      }),
      buildParams(baseParams)
    );
    expect(createDocumentSection).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "Folder" })
    );
  });

  it("rejects an empty name", async () => {
    setupAuth(mocks.auth, mockSession());
    const res = await POST_SECTIONS(
      buildRequest(basePath, {
        method: "POST",
        body: { name: "" },
      }),
      buildParams(baseParams)
    );
    expect((await parseResponse(res)).status).toBe(400);
    expect(createDocumentSection).not.toHaveBeenCalled();
  });

  it("returns 409 on duplicate name (unique violation)", async () => {
    setupAuth(mocks.auth, mockSession());
    const err = Object.assign(new Error("duplicate"), { code: "23505" });
    vi.mocked(createDocumentSection).mockRejectedValue(err);

    const res = await POST_SECTIONS(
      buildRequest(basePath, {
        method: "POST",
        body: { name: "Contracts" },
      }),
      buildParams(baseParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: expect.stringMatching(/already exists/i),
    });
  });

  it("forbids clients from creating sections", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await POST_SECTIONS(
      buildRequest(basePath, {
        method: "POST",
        body: { name: "Sneaky" },
      }),
      buildParams(baseParams)
    );
    expect((await parseResponse(res)).status).toBe(403);
    expect(createDocumentSection).not.toHaveBeenCalled();
  });
});

// ── PATCH section ───────────────────────────────────────────────────────────

describe("PATCH .../document-sections/[sectionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames a section", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);
    const renamed = { ...sampleSection, name: "MoM" };
    vi.mocked(updateDocumentSection).mockResolvedValue(renamed as never);

    const res = await PATCH_SECTION(
      buildRequest(sectionPath, { method: "PATCH", body: { name: "MoM" } }),
      buildParams(sectionParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toEqual(renamed);
    expect(updateDocumentSection).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: SECTION_ID, name: "MoM" })
    );
  });

  it("returns 404 when the section does not exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(null);
    const res = await PATCH_SECTION(
      buildRequest(sectionPath, { method: "PATCH", body: { name: "MoM" } }),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });

  it("returns 409 on rename collision (unique violation)", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);
    const err = Object.assign(new Error("duplicate"), { code: "23505" });
    vi.mocked(updateDocumentSection).mockRejectedValue(err);

    const res = await PATCH_SECTION(
      buildRequest(sectionPath, {
        method: "PATCH",
        body: { name: "Contracts" },
      }),
      buildParams(sectionParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: expect.stringMatching(/already exists/i),
    });
  });
});

// ── DELETE section ──────────────────────────────────────────────────────────

describe("DELETE .../document-sections/[sectionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the section and cleans up storage paths", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentSection).mockResolvedValue([
      `projects/${PROJECT_ID}/documents/a-file.pdf`,
    ]);

    const res = await DELETE_SECTION(
      buildRequest(sectionPath, { method: "DELETE" }),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(200);
    expect(deleteDocumentSection).toHaveBeenCalledWith(SECTION_ID, PROJECT_ID);
    expect(mocks.supabase.remove).toHaveBeenCalledWith([
      `projects/${PROJECT_ID}/documents/a-file.pdf`,
    ]);
  });

  it("skips storage cleanup when the section is empty", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentSection).mockResolvedValue([]);

    await DELETE_SECTION(
      buildRequest(sectionPath, { method: "DELETE" }),
      buildParams(sectionParams)
    );
    expect(deleteDocumentSection).toHaveBeenCalledWith(SECTION_ID, PROJECT_ID);
    expect(mocks.supabase.remove).not.toHaveBeenCalled();
  });

  it("returns 404 when the section doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentSection).mockResolvedValue(null);

    const res = await DELETE_SECTION(
      buildRequest(sectionPath, { method: "DELETE" }),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
    expect(mocks.supabase.remove).not.toHaveBeenCalled();
  });
});

// ── GET documents ───────────────────────────────────────────────────────────

describe("GET .../sections/[sectionId]/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the document list", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);
    vi.mocked(listSectionDocuments).mockResolvedValue([sampleDoc] as never);

    const res = await GET_DOCS(
      buildRequest(docsPath),
      buildParams(sectionParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toEqual([sampleDoc]);
  });

  it("returns 404 when the section is missing", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(null);
    const res = await GET_DOCS(
      buildRequest(docsPath),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

// ── GET all documents ───────────────────────────────────────────────────────

describe("GET .../projects/[id]/documents (All view)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns every document in the project", async () => {
    setupAuth(mocks.auth, mockSession());
    const docWithSection = { ...sampleDoc, section_name: "Minutes of Meeting" };
    vi.mocked(listProjectDocuments).mockResolvedValue([
      docWithSection,
    ] as never);

    const res = await GET_ALL_DOCS(
      buildRequest(`/api/projects/${PROJECT_ID}/documents`),
      buildParams(baseParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toEqual([docWithSection]);
    expect(listProjectDocuments).toHaveBeenCalledWith(PROJECT_ID);
  });

  it("returns 401 without a session", async () => {
    setupAuth(mocks.auth, null);
    const res = await GET_ALL_DOCS(
      buildRequest(`/api/projects/${PROJECT_ID}/documents`),
      buildParams(baseParams)
    );
    expect((await parseResponse(res)).status).toBe(401);
  });
});

// ── POST upload-url ─────────────────────────────────────────────────────────

describe("POST .../documents/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a signed URL and storage path under the project prefix", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);

    const res = await POST_UPLOAD_URL(
      buildRequest(uploadUrlPath, {
        method: "POST",
        body: { fileName: "kickoff.pdf", fileSize: 1234 },
      }),
      buildParams(sectionParams)
    );
    const { status, body } = await parseResponse<{
      signedUrl: string;
      storagePath: string;
    }>(res);
    expect(status).toBe(200);
    expect(
      body.storagePath.startsWith(`projects/${PROJECT_ID}/documents/`)
    ).toBe(true);
    expect(body.signedUrl).toBeTruthy();
  });

  it("rejects file extensions not in the allow-list", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);

    const res = await POST_UPLOAD_URL(
      buildRequest(uploadUrlPath, {
        method: "POST",
        body: { fileName: "malware.exe", fileSize: 1234 },
      }),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(400);
  });
});

// ── POST document ───────────────────────────────────────────────────────────

describe("POST .../sections/[sectionId]/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a document row with the issued storage path", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);
    vi.mocked(createDocument).mockResolvedValue(sampleDoc as never);

    const res = await POST_DOC(
      buildRequest(docsPath, {
        method: "POST",
        body: {
          fileName: "kickoff.pdf",
          fileSize: 1234,
          mimeType: "application/pdf",
          storagePath: `projects/${PROJECT_ID}/documents/abc-kickoff.pdf`,
        },
      }),
      buildParams(sectionParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body).toEqual(sampleDoc);
  });

  it("refuses a storagePath that doesn't belong to this project", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentSectionById).mockResolvedValue(sampleSection as never);

    const res = await POST_DOC(
      buildRequest(docsPath, {
        method: "POST",
        body: {
          fileName: "stolen.pdf",
          fileSize: 1234,
          mimeType: "application/pdf",
          storagePath: `projects/other-project/documents/stolen.pdf`,
        },
      }),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(400);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("forbids clients from uploading", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await POST_DOC(
      buildRequest(docsPath, {
        method: "POST",
        body: {
          fileName: "x.pdf",
          fileSize: 1,
          mimeType: "application/pdf",
          storagePath: `projects/${PROJECT_ID}/documents/x.pdf`,
        },
      }),
      buildParams(sectionParams)
    );
    expect((await parseResponse(res)).status).toBe(403);
  });
});

// ── GET download ────────────────────────────────────────────────────────────

describe("GET .../documents/[documentId]/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a short-lived signed URL", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentById).mockResolvedValue(sampleDoc as never);

    const res = await GET_DOWNLOAD(
      buildRequest(downloadPath),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse<{ url: string }>(res);
    expect(status).toBe(200);
    expect(body.url).toBeTruthy();
    expect(mocks.supabase.createSignedUrl).toHaveBeenCalled();
  });

  it("works for client viewers", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    vi.mocked(getDocumentById).mockResolvedValue(sampleDoc as never);

    const res = await GET_DOWNLOAD(
      buildRequest(downloadPath),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(200);
  });
});

// ── DELETE document ─────────────────────────────────────────────────────────

describe("DELETE .../documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes every storage object for the version group", async () => {
    setupAuth(mocks.auth, mockSession());
    const otherPath = `projects/${PROJECT_ID}/documents/old-rev1.pdf`;
    vi.mocked(deleteDocument).mockResolvedValue([
      sampleDoc.storage_path,
      otherPath,
    ]);

    const res = await DELETE_DOC(
      buildRequest(docPath, { method: "DELETE" }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(200);
    expect(deleteDocument).toHaveBeenCalledWith(DOC_ID, PROJECT_ID);
    expect(mocks.supabase.remove).toHaveBeenCalledWith([
      sampleDoc.storage_path,
      otherPath,
    ]);
  });

  it("forbids clients from deleting", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await DELETE_DOC(
      buildRequest(docPath, { method: "DELETE" }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(403);
    expect(deleteDocument).not.toHaveBeenCalled();
  });
});

// ── PATCH document ──────────────────────────────────────────────────────────

const TARGET_SECTION_ID = "11111111-1111-4111-8111-111111111111";

describe("PATCH .../documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames the document", async () => {
    setupAuth(mocks.auth, mockSession());
    mockPatchPreconditions();
    const renamed = { ...sampleDoc, file_name: "renamed.pdf" };
    vi.mocked(updateDocument).mockResolvedValue(renamed as never);

    const res = await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { fileName: "renamed.pdf" },
      }),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toEqual(renamed);
    expect(updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: DOC_ID,
        projectId: PROJECT_ID,
        fileName: "renamed.pdf",
      })
    );
  });

  it("updates the description (and clears it via empty string)", async () => {
    setupAuth(mocks.auth, mockSession());
    mockPatchPreconditions();
    vi.mocked(updateDocument).mockResolvedValue(sampleDoc as never);

    await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { description: "Updated notes." },
      }),
      buildParams(docParams)
    );
    expect(updateDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: "Updated notes." })
    );

    await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { description: null },
      }),
      buildParams(docParams)
    );
    expect(updateDocument).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: null })
    );
  });

  it("moves the document to a different section after validating ownership", async () => {
    setupAuth(mocks.auth, mockSession());
    mockPatchPreconditions();
    vi.mocked(getDocumentSectionById).mockResolvedValue({
      ...sampleSection,
      id: TARGET_SECTION_ID,
    } as never);
    vi.mocked(updateDocument).mockResolvedValue({
      ...sampleDoc,
      section_id: TARGET_SECTION_ID,
    } as never);

    const res = await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { sectionId: TARGET_SECTION_ID },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(200);
    expect(getDocumentSectionById).toHaveBeenCalledWith(
      TARGET_SECTION_ID,
      PROJECT_ID
    );
    expect(updateDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: TARGET_SECTION_ID })
    );
  });

  it("rejects a sectionId that doesn't belong to this project (400)", async () => {
    setupAuth(mocks.auth, mockSession());
    mockPatchPreconditions();
    vi.mocked(getDocumentSectionById).mockResolvedValue(null);

    const res = await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { sectionId: TARGET_SECTION_ID },
      }),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body).toMatchObject({
      error: expect.stringMatching(/target section/i),
    });
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it("returns 404 when the document doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentById).mockResolvedValue(null);

    const res = await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { fileName: "anything.pdf" },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it("returns 409 when the target row is not the latest version", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentById).mockResolvedValue({
      ...sampleDoc,
      version: 2,
    } as never);
    vi.mocked(getLatestVersionForDocument).mockResolvedValue({
      versionGroup: sampleDoc.version_group,
      latestVersion: 5,
    });

    const res = await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { fileName: "x.pdf" },
      }),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: expect.stringMatching(/latest version/i),
    });
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it("rejects an empty body (no fields supplied)", async () => {
    setupAuth(mocks.auth, mockSession());
    const res = await PATCH_DOC(
      buildRequest(docPath, { method: "PATCH", body: {} }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(400);
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it("forbids clients from editing documents", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await PATCH_DOC(
      buildRequest(docPath, {
        method: "PATCH",
        body: { fileName: "x.pdf" },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(403);
    expect(updateDocument).not.toHaveBeenCalled();
  });
});

// ── Versions ────────────────────────────────────────────────────────────────

const VERSION_ID = "ver-2";
const versionsPath = `${docPath}/versions`;
const versionUploadUrlPath = `${versionsPath}/upload-url`;
const versionItemPath = `${versionsPath}/${VERSION_ID}`;
const revertPath = `${docPath}/revert`;
const versionParams = {
  id: PROJECT_ID,
  documentId: DOC_ID,
  versionId: VERSION_ID,
};

const v1 = { ...sampleDoc, id: "ver-1", version: 1 };
const v2 = {
  ...sampleDoc,
  id: VERSION_ID,
  version: 2,
  file_name: "kickoff-rev2.pdf",
  storage_path: `projects/${PROJECT_ID}/documents/def-kickoff-rev2.pdf`,
};

describe("GET .../documents/[documentId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the version history oldest-first", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentVersionHistory).mockResolvedValue([v1, v2] as never);

    const res = await GET_VERSIONS(
      buildRequest(versionsPath),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toEqual([v1, v2]);
    expect(getDocumentVersionHistory).toHaveBeenCalledWith(DOC_ID, PROJECT_ID);
  });

  it("returns 404 when the document doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentVersionHistory).mockResolvedValue(null);

    const res = await GET_VERSIONS(
      buildRequest(versionsPath),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

describe("POST .../documents/[documentId]/versions/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mints a signed URL after validating the doc exists", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentById).mockResolvedValue(sampleDoc as never);

    const res = await POST_VERSION_UPLOAD_URL(
      buildRequest(versionUploadUrlPath, {
        method: "POST",
        body: { fileName: "rev2.pdf", fileSize: 12345 },
      }),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body).toMatchObject({ signedUrl: expect.any(String) });
    expect(body.storagePath).toMatch(
      new RegExp(`^projects/${PROJECT_ID}/documents/`)
    );
  });

  it("returns 404 when the document doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getDocumentById).mockResolvedValue(null);

    const res = await POST_VERSION_UPLOAD_URL(
      buildRequest(versionUploadUrlPath, {
        method: "POST",
        body: { fileName: "rev2.pdf", fileSize: 12345 },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });

  it("forbids clients", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await POST_VERSION_UPLOAD_URL(
      buildRequest(versionUploadUrlPath, {
        method: "POST",
        body: { fileName: "rev2.pdf", fileSize: 12345 },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(403);
  });
});

describe("POST .../documents/[documentId]/versions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new version row", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(createDocumentVersion).mockResolvedValue(v2 as never);

    const res = await POST_VERSION(
      buildRequest(versionsPath, {
        method: "POST",
        body: {
          fileName: "rev2.pdf",
          fileSize: 12345,
          mimeType: "application/pdf",
          storagePath: `projects/${PROJECT_ID}/documents/def-rev2.pdf`,
        },
      }),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body).toEqual(v2);
    expect(createDocumentVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        documentId: DOC_ID,
        fileName: "rev2.pdf",
      })
    );
  });

  it("rejects a storagePath from a different project", async () => {
    setupAuth(mocks.auth, mockSession());

    const res = await POST_VERSION(
      buildRequest(versionsPath, {
        method: "POST",
        body: {
          fileName: "rev2.pdf",
          fileSize: 12345,
          mimeType: "application/pdf",
          storagePath: `projects/other/documents/abc.pdf`,
        },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(400);
    expect(createDocumentVersion).not.toHaveBeenCalled();
  });

  it("returns 404 when the document doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(createDocumentVersion).mockResolvedValue(null);

    const res = await POST_VERSION(
      buildRequest(versionsPath, {
        method: "POST",
        body: {
          fileName: "rev2.pdf",
          fileSize: 12345,
          mimeType: "application/pdf",
          storagePath: `projects/${PROJECT_ID}/documents/def-rev2.pdf`,
        },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

describe("POST .../documents/[documentId]/revert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reverts to the target version", async () => {
    setupAuth(mocks.auth, mockSession());
    const v3 = { ...sampleDoc, id: "ver-3", version: 3 };
    vi.mocked(revertDocumentToVersion).mockResolvedValue(v3 as never);

    const res = await POST_REVERT(
      buildRequest(revertPath, {
        method: "POST",
        body: { targetVersion: 1 },
      }),
      buildParams(docParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(201);
    expect(body).toEqual(v3);
    expect(revertDocumentToVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: DOC_ID,
        targetVersion: 1,
      })
    );
  });

  it("returns 404 when the target version doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(revertDocumentToVersion).mockResolvedValue(
      "target_not_found" as never
    );

    const res = await POST_REVERT(
      buildRequest(revertPath, {
        method: "POST",
        body: { targetVersion: 99 },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });

  it("returns 404 when the document doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(revertDocumentToVersion).mockResolvedValue(null);

    const res = await POST_REVERT(
      buildRequest(revertPath, {
        method: "POST",
        body: { targetVersion: 1 },
      }),
      buildParams(docParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });
});

describe("DELETE .../documents/[documentId]/versions/[versionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes the row + storage object when no other row references it", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentVersion).mockResolvedValue({
      kind: "deleted",
      storagePathToRemove: v2.storage_path,
    });

    const res = await DELETE_VERSION(
      buildRequest(versionItemPath, { method: "DELETE" }),
      buildParams(versionParams)
    );
    expect((await parseResponse(res)).status).toBe(200);
    expect(mocks.supabase.remove).toHaveBeenCalledWith([v2.storage_path]);
  });

  it("keeps the storage object when a revert still references it", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentVersion).mockResolvedValue({
      kind: "deleted",
      storagePathToRemove: null,
    });

    const res = await DELETE_VERSION(
      buildRequest(versionItemPath, { method: "DELETE" }),
      buildParams(versionParams)
    );
    expect((await parseResponse(res)).status).toBe(200);
    expect(mocks.supabase.remove).not.toHaveBeenCalled();
  });

  it("returns 409 when it's the last remaining version", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentVersion).mockResolvedValue("last_version" as never);

    const res = await DELETE_VERSION(
      buildRequest(versionItemPath, { method: "DELETE" }),
      buildParams(versionParams)
    );
    const { status, body } = await parseResponse(res);
    expect(status).toBe(409);
    expect(body).toMatchObject({
      error: expect.stringMatching(/last remaining/i),
    });
    expect(mocks.supabase.remove).not.toHaveBeenCalled();
  });

  it("returns 404 when the version doesn't exist", async () => {
    setupAuth(mocks.auth, mockSession());
    vi.mocked(deleteDocumentVersion).mockResolvedValue(null);

    const res = await DELETE_VERSION(
      buildRequest(versionItemPath, { method: "DELETE" }),
      buildParams(versionParams)
    );
    expect((await parseResponse(res)).status).toBe(404);
  });

  it("forbids clients", async () => {
    setupAuth(mocks.auth, mockSession({ role: "client" }));
    const res = await DELETE_VERSION(
      buildRequest(versionItemPath, { method: "DELETE" }),
      buildParams(versionParams)
    );
    expect((await parseResponse(res)).status).toBe(403);
    expect(deleteDocumentVersion).not.toHaveBeenCalled();
  });
});
