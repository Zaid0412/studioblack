/**
 * Unit tests for the nesting-related branches of `createDocumentSection` and
 * `updateDocumentSection`. Module-level mock stubs the queries barrel — we
 * pull the real implementations via `vi.importActual` and drive the pg mock.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mocks } from "../setup";

vi.setConfig({ testTimeout: 20000 });

async function real() {
  return await vi.importActual<typeof import("@/lib/queries/projectDocuments")>(
    "@/lib/queries/projectDocuments"
  );
}

const PROJECT = "00000000-0000-0000-0000-000000000001";
const SECTION = "00000000-0000-0000-0000-00000000000a";
const PARENT = "00000000-0000-0000-0000-00000000000b";

beforeEach(() => vi.clearAllMocks());

function queue(...results: Array<{ rows: unknown[] }>) {
  for (const r of results) mocks.db.query.mockResolvedValueOnce(r);
}

// ─── createDocumentSection ────────────────────────────────────────────────

describe("createDocumentSection — parent guards", () => {
  it("inserts under a valid top-level parent", async () => {
    const { createDocumentSection } = await real();
    queue(
      { rows: [{ parent_id: null }] }, // parent lookup
      { rows: [{ id: SECTION, parent_id: PARENT, name: "Subs" }] } // INSERT
    );
    const row = await createDocumentSection({
      projectId: PROJECT,
      name: "Subs",
      icon: "Folder",
      parentId: PARENT,
      createdBy: "u-1",
    });
    expect(row).toMatchObject({ id: SECTION, parent_id: PARENT });
  });

  it("returns parent_not_found when the parent isn't in this project", async () => {
    const { createDocumentSection } = await real();
    queue({ rows: [] }); // parent lookup returns nothing
    const row = await createDocumentSection({
      projectId: PROJECT,
      name: "Subs",
      icon: "Folder",
      parentId: PARENT,
      createdBy: "u-1",
    });
    expect(row).toBe("parent_not_found");
  });

  it("returns parent_too_deep when the parent already has a parent", async () => {
    const { createDocumentSection } = await real();
    queue({ rows: [{ parent_id: PARENT }] }); // parent has a parent itself
    const row = await createDocumentSection({
      projectId: PROJECT,
      name: "Sub-sub",
      icon: "Folder",
      parentId: PARENT,
      createdBy: "u-1",
    });
    expect(row).toBe("parent_too_deep");
  });

  it("scopes the next-position MAX to the target parent's children", async () => {
    const { createDocumentSection } = await real();
    queue(
      { rows: [{ parent_id: null }] }, // parent lookup
      { rows: [{ id: SECTION, parent_id: PARENT, name: "Subs", position: 5 }] }
    );
    await createDocumentSection({
      projectId: PROJECT,
      name: "Subs",
      icon: "Folder",
      parentId: PARENT,
      createdBy: "u-1",
    });
    // The INSERT's `next_pos` CTE must filter by the target parent_id, not
    // by the whole project — otherwise a sub-section at "position 12" of
    // the new parent leaves visual gaps. `IS NOT DISTINCT FROM` lets the
    // same query handle both top-level (parent_id IS NULL) and nested.
    const insertCall = mocks.db.query.mock.calls[1]!;
    expect(insertCall[0]).toMatch(/parent_id IS NOT DISTINCT FROM/);
  });
});

// ─── updateDocumentSection ────────────────────────────────────────────────

describe("updateDocumentSection — reparent guards", () => {
  it("returns parent_self when reparenting a section to itself", async () => {
    const { updateDocumentSection } = await real();
    const row = await updateDocumentSection({
      sectionId: SECTION,
      projectId: PROJECT,
      parentId: SECTION,
    });
    expect(row).toBe("parent_self");
  });

  it("returns parent_too_deep when target parent already has a parent", async () => {
    const { updateDocumentSection } = await real();
    queue({
      rows: [
        {
          target_parent_id: "some-other-parent",
          target_exists: true,
          source_has_children: false,
        },
      ],
    });
    const row = await updateDocumentSection({
      sectionId: SECTION,
      projectId: PROJECT,
      parentId: PARENT,
    });
    expect(row).toBe("parent_too_deep");
  });

  it("returns reparent_with_children when the moved section has children", async () => {
    const { updateDocumentSection } = await real();
    queue({
      rows: [
        {
          target_parent_id: null,
          target_exists: true,
          source_has_children: true,
        },
      ],
    });
    const row = await updateDocumentSection({
      sectionId: SECTION,
      projectId: PROJECT,
      parentId: PARENT,
    });
    expect(row).toBe("reparent_with_children");
  });

  it("auto-assigns position at the tail of the new parent's children", async () => {
    const { updateDocumentSection } = await real();
    queue(
      {
        rows: [
          {
            target_parent_id: null,
            target_exists: true,
            source_has_children: false,
          },
        ],
      },
      { rows: [{ id: SECTION, parent_id: PARENT }] }
    );
    await updateDocumentSection({
      sectionId: SECTION,
      projectId: PROJECT,
      parentId: PARENT,
    });
    const updateCall = mocks.db.query.mock.calls[1]!;
    // The UPDATE must include a `position = (SELECT COALESCE(MAX(position)...`
    // subquery scoped to the new parent's children — without it, the
    // section keeps its old position and lands mid-group under the new
    // parent.
    expect(updateCall[0]).toMatch(/position\s*=\s*\(/);
    expect(updateCall[0]).toMatch(/MAX\(position\)/);
    expect(updateCall[0]).toMatch(/parent_id IS NOT DISTINCT FROM/);
  });

  it("uses the explicit position when both parentId and position are set", async () => {
    const { updateDocumentSection } = await real();
    queue(
      {
        rows: [
          {
            target_parent_id: null,
            target_exists: true,
            source_has_children: false,
          },
        ],
      },
      { rows: [{ id: SECTION, parent_id: PARENT, position: 2 }] }
    );
    await updateDocumentSection({
      sectionId: SECTION,
      projectId: PROJECT,
      parentId: PARENT,
      position: 2,
    });
    const updateCall = mocks.db.query.mock.calls[1]!;
    // When position is explicit, the auto-assign subquery must NOT be
    // included — otherwise the explicit value would be overwritten.
    expect(updateCall[0]).not.toMatch(/COALESCE\(MAX\(position\)/);
  });

  it("allows reparenting to top-level (null parent)", async () => {
    const { updateDocumentSection } = await real();
    queue(
      {
        rows: [
          {
            target_parent_id: null,
            target_exists: false,
            source_has_children: false,
          },
        ],
      },
      {
        rows: [{ id: SECTION, parent_id: null, name: "Now top" }],
      } // UPDATE
    );
    const row = await updateDocumentSection({
      sectionId: SECTION,
      projectId: PROJECT,
      parentId: null,
    });
    expect(row).toMatchObject({ id: SECTION, parent_id: null });
  });
});
