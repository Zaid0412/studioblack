/**
 * Transactional query unit tests — the module-level mock in `setup.ts`
 * stubs the queries barrel, so we pull the real implementations via
 * `vi.importActual` and drive a sequenced pg mock. Every query inside a
 * transaction (BEGIN → … → COMMIT/ROLLBACK) goes through the same mock,
 * so each `mockResolvedValueOnce` consumes one client.query call.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DbProjectDocument } from "@/types";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

async function real() {
  return await vi.importActual<typeof import("@/lib/queries/projectDocuments")>(
    "@/lib/queries/projectDocuments"
  );
}

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const DOC_ID = "00000000-0000-0000-0000-00000000000a";
const VERSION_ID = "00000000-0000-0000-0000-00000000000b";
const VERSION_GROUP = "00000000-0000-0000-0000-00000000aaaa";
const SECTION_ID = "00000000-0000-0000-0000-00000000000c";
const UPLOADED_BY = "user-001";

beforeEach(() => {
  vi.clearAllMocks();
});

function queue(...results: Array<{ rows: unknown[] }>) {
  for (const r of results) mocks.db.query.mockResolvedValueOnce(r);
}

// ─── createDocumentVersion ────────────────────────────────────────────────

describe("createDocumentVersion", () => {
  it("locks the current latest, inserts at version+1 with inherited section", async () => {
    const { createDocumentVersion } = await real();
    // BEGIN → SELECT ... FOR UPDATE → INSERT → COMMIT
    queue(
      { rows: [] }, // BEGIN
      {
        rows: [
          {
            version_group: VERSION_GROUP,
            section_id: SECTION_ID,
            version: 4,
          },
        ],
      },
      {
        rows: [
          {
            id: "new-v5",
            version: 5,
            version_group: VERSION_GROUP,
            file_name: "rev5.pdf",
          },
        ],
      },
      { rows: [] } // COMMIT
    );

    const row = await createDocumentVersion({
      projectId: PROJECT_ID,
      documentId: DOC_ID,
      fileName: "rev5.pdf",
      fileSize: 1234,
      mimeType: "application/pdf",
      storagePath: `projects/${PROJECT_ID}/documents/abc-rev5.pdf`,
      uploadedBy: UPLOADED_BY,
    });

    expect(row).toMatchObject({ id: "new-v5", version: 5 });
    const insertCall = mocks.db.query.mock.calls[2]!;
    // Position 9 = version, position 10 = version_group
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([5, VERSION_GROUP, SECTION_ID])
    );
  });

  it("returns null + rolls back when the document doesn't exist", async () => {
    const { createDocumentVersion } = await real();
    queue(
      { rows: [] }, // BEGIN
      { rows: [] }, // SELECT returns nothing
      { rows: [] } // ROLLBACK
    );

    const row = await createDocumentVersion({
      projectId: PROJECT_ID,
      documentId: DOC_ID,
      fileName: "rev5.pdf",
      fileSize: 1234,
      mimeType: "application/pdf",
      storagePath: `projects/${PROJECT_ID}/documents/abc.pdf`,
      uploadedBy: UPLOADED_BY,
    });
    expect(row).toBeNull();
    const lastCall =
      mocks.db.query.mock.calls[mocks.db.query.mock.calls.length - 1]!;
    expect(lastCall[0]).toBe("ROLLBACK");
  });
});

// ─── revertDocumentToVersion ──────────────────────────────────────────────

describe("revertDocumentToVersion", () => {
  it("creates a new row at group_max+1 reusing the target version's storage_path", async () => {
    const { revertDocumentToVersion } = await real();
    // BEGIN → group lookup → locked target (with group_max) → INSERT → COMMIT
    queue(
      { rows: [] }, // BEGIN
      { rows: [{ version_group: VERSION_GROUP }] }, // group lookup
      {
        rows: [
          {
            section_id: SECTION_ID,
            file_name: "v2.pdf",
            file_size: 99,
            mime_type: "application/pdf",
            storage_path: "projects/p/documents/v2.pdf",
            description: null,
            group_max: 4,
          },
        ],
      },
      {
        rows: [
          {
            id: "new-v5",
            version: 5,
            storage_path: "projects/p/documents/v2.pdf",
          } as Partial<DbProjectDocument>,
        ],
      },
      { rows: [] } // COMMIT
    );

    const row = await revertDocumentToVersion({
      documentId: DOC_ID,
      projectId: PROJECT_ID,
      targetVersion: 2,
      uploadedBy: UPLOADED_BY,
    });
    expect(row).toMatchObject({ id: "new-v5", version: 5 });
    const insertCall = mocks.db.query.mock.calls[3]!;
    // version param = group_max + 1 = 5; storage_path is the V2 path (reused)
    expect(insertCall[1]).toEqual(
      expect.arrayContaining([5, "projects/p/documents/v2.pdf"])
    );
  });

  it("returns 'target_not_found' when the target version doesn't exist in the group", async () => {
    const { revertDocumentToVersion } = await real();
    queue(
      { rows: [] }, // BEGIN
      { rows: [{ version_group: VERSION_GROUP }] }, // group lookup
      { rows: [] }, // FOR UPDATE select — no row at targetVersion
      { rows: [] } // ROLLBACK
    );
    const row = await revertDocumentToVersion({
      documentId: DOC_ID,
      projectId: PROJECT_ID,
      targetVersion: 99,
      uploadedBy: UPLOADED_BY,
    });
    expect(row).toBe("target_not_found");
  });

  it("returns null when the document doesn't exist", async () => {
    const { revertDocumentToVersion } = await real();
    queue(
      { rows: [] }, // BEGIN
      { rows: [] }, // group lookup misses
      { rows: [] } // ROLLBACK
    );
    const row = await revertDocumentToVersion({
      documentId: DOC_ID,
      projectId: PROJECT_ID,
      targetVersion: 2,
      uploadedBy: UPLOADED_BY,
    });
    expect(row).toBeNull();
  });
});

// ─── deleteDocumentVersion ────────────────────────────────────────────────

describe("deleteDocumentVersion", () => {
  it("returns storagePathToRemove when no other row references the path", async () => {
    const { deleteDocumentVersion } = await real();
    queue(
      { rows: [] }, // BEGIN
      {
        rows: [
          {
            version_group: VERSION_GROUP,
            storage_path: "projects/p/documents/orphan.pdf",
            group_count: "3",
            siblings_same_path: "0",
          },
        ],
      },
      { rows: [] }, // DELETE
      { rows: [] } // COMMIT
    );

    const result = await deleteDocumentVersion({
      documentId: DOC_ID,
      versionId: VERSION_ID,
      projectId: PROJECT_ID,
    });
    expect(result).toEqual({
      kind: "deleted",
      storagePathToRemove: "projects/p/documents/orphan.pdf",
    });
  });

  it("returns storagePathToRemove=null when a sibling (e.g. revert) shares the path", async () => {
    const { deleteDocumentVersion } = await real();
    queue(
      { rows: [] }, // BEGIN
      {
        rows: [
          {
            version_group: VERSION_GROUP,
            storage_path: "projects/p/documents/shared.pdf",
            group_count: "4",
            siblings_same_path: "1", // a revert references the same path
          },
        ],
      },
      { rows: [] }, // DELETE
      { rows: [] } // COMMIT
    );
    const result = await deleteDocumentVersion({
      documentId: DOC_ID,
      versionId: VERSION_ID,
      projectId: PROJECT_ID,
    });
    expect(result).toEqual({
      kind: "deleted",
      storagePathToRemove: null,
    });
  });

  it("refuses when the row is the last remaining version", async () => {
    const { deleteDocumentVersion } = await real();
    queue(
      { rows: [] }, // BEGIN
      {
        rows: [
          {
            version_group: VERSION_GROUP,
            storage_path: "projects/p/documents/only.pdf",
            group_count: "1",
            siblings_same_path: "0",
          },
        ],
      },
      { rows: [] } // ROLLBACK
    );
    const result = await deleteDocumentVersion({
      documentId: DOC_ID,
      versionId: VERSION_ID,
      projectId: PROJECT_ID,
    });
    expect(result).toBe("last_version");
  });

  it("returns null when the versionId doesn't belong to the documentId", async () => {
    const { deleteDocumentVersion } = await real();
    // The FOR UPDATE select filters by version_group = (the document's group).
    // A mismatched pair returns no row.
    queue(
      { rows: [] }, // BEGIN
      { rows: [] }, // SELECT — no match
      { rows: [] } // ROLLBACK
    );
    const result = await deleteDocumentVersion({
      documentId: DOC_ID,
      versionId: VERSION_ID,
      projectId: PROJECT_ID,
    });
    expect(result).toBeNull();
  });
});
