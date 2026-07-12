/**
 * Strategy-branch unit tests for `bulkUpsertElements`. The module-level mock
 * in `setup.ts` replaces the whole function with a stub — here we import the
 * actual implementation via `vi.importActual` and drive it through a sequenced
 * pg mock so the version/overwrite paths (`insertElementVersion`,
 * `overwriteElementRow`) are exercised for real.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  BulkElementImportInput,
  BulkElementImportResult,
} from "@/lib/queries";
import { mocks } from "../setup";

// The first test resolves `vi.importActual` for the elements submodule; under
// parallel worker load this can push past the default 5s timeout even though
// the test completes in ~2s in isolation.
vi.setConfig({ testTimeout: 20000 });

// Pull the real implementation out of the globally mocked queries barrel.
// Importing the submodule directly avoids loading all 18 query files via
// `@/lib/queries`, which can exceed the 5s test timeout under parallel load.
async function realBulkUpsertElements(
  orgId: string,
  input: BulkElementImportInput
): Promise<BulkElementImportResult> {
  const actual = await vi.importActual<typeof import("@/lib/queries/elements")>(
    "@/lib/queries/elements"
  );
  return actual.bulkUpsertElements(orgId, input);
}

// Sequenced pg mock helper. Pushes `{ rows }` responses in order — each
// client.query call consumes one. Non-matching SQL falls through to `{}`.
function queueQueryResults(
  results: Array<{ rows: unknown[]; rowCount?: number | null }>
) {
  for (const r of results) {
    mocks.db.query.mockResolvedValueOnce(r);
  }
}

// Elements must sit under a Service Area, so every row needs a path that
// resolves to a level-3 node. One chain serves the whole file.
const CATEGORY_ROWS = [
  {
    id: "cat-1",
    name: "Kitchen",
    parent_id: null,
    code_prefix: "KIT",
    level: 1,
  },
  {
    id: "cat-2",
    name: "Cabinets",
    parent_id: "cat-1",
    code_prefix: "KIT-CAB",
    level: 2,
  },
  {
    id: "cat-3",
    name: "Base Cabinets",
    parent_id: "cat-2",
    code_prefix: "KIT-CAB-BASE",
    level: 3,
  },
];

const SERVICE_AREA_PATH = ["Kitchen", "Cabinets", "Base Cabinets"];

const ORG = "org-test-001";
const CREATED_BY = "user-test-001";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bulkUpsertElements — version strategy", () => {
  it("appends a new version_number onto the existing group and preserves attributes", async () => {
    // 1. categories lookup (top of bulkUpsertElements)
    // 2. BEGIN
    // 3. SAVEPOINT bulk_row
    // 4. pg_advisory_xact_lock
    // 5. findLatestByCode inside tryInsertElementRow → returns existing v3
    //    (so tryInsertElementRow returns null → fallthrough to version branch)
    // 6. findLatestByCode inside version branch → returns same v3
    // 7. SELECT prev row columns (for blank-cell inheritance)
    // 8. INSERT element … RETURNING id
    // 9. INSERT element_attribute … SELECT FROM element_attribute
    // 10. RELEASE SAVEPOINT
    // 11. COMMIT
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // (1) element_category lookup
      { rows: [] }, // (2) BEGIN
      { rows: [] }, // (3) SAVEPOINT bulk_row
      { rows: [] }, // (4) advisory lock
      {
        rows: [
          {
            id: "existing-v3-id",
            version_group: "grp-1",
            version_number: 3,
          },
        ],
      }, // (5) findLatestByCode (tryInsertElementRow path)
      {
        rows: [
          {
            id: "existing-v3-id",
            version_group: "grp-1",
            version_number: 3,
          },
        ],
      }, // (6) findLatestByCode (version branch)
      {
        rows: [
          {
            description: "Prev description",
            category_id: null,
            currency: "USD",
            material_cost: null,
            labour_cost: null,
            overhead_pct: null,
            margin_pct: null,
            spec_reference: null,
            drawing_ref: null,
            tags: null,
          },
        ],
      }, // (7) SELECT prev row columns
      { rows: [{ id: "new-v4-id" }] }, // (8) INSERT new version
      { rows: [] }, // (9) attribute copy
      { rows: [] }, // (10) RELEASE SAVEPOINT
      { rows: [] }, // (11) COMMIT
    ]);

    const result = await realBulkUpsertElements(ORG, {
      strategy: "version",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          code: "WAL-PNT-001",
          name: "Paint v4",
          unit: "m2",
          unitCost: 14,
        },
      ],
    });

    expect(result.versioned).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.failed).toEqual([]);

    // Find the INSERT-element call and assert the version_group + version_number.
    const insertCall = mocks.db.query.mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("INSERT INTO element") &&
        c[0].includes("version_group") &&
        c[0].includes("version_number")
    );
    expect(insertCall).toBeDefined();
    const params = insertCall?.[1] as unknown[];
    // Last two params are (version_group, version_number) per the SQL.
    expect(params[params.length - 2]).toBe("grp-1");
    expect(params[params.length - 1]).toBe(4);

    // Attribute-copy INSERT must reference the previous latest id as source.
    const attrCopy = mocks.db.query.mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("INSERT INTO element_attribute") &&
        c[0].includes("SELECT")
    );
    expect(attrCopy).toBeDefined();
    const attrParams = attrCopy?.[1] as unknown[];
    expect(attrParams[0]).toBe("new-v4-id");
    expect(attrParams[1]).toBe("existing-v3-id");
  });

  it("inherits prev row's optional fields when the sheet row has blank cells", async () => {
    // When a versioned import leaves the description cell blank, the new
    // version must inherit the prior description — not silently null it.
    // Same semantic as the overwrite strategy (blank = leave alone).
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // (1) category tree
      { rows: [] }, // (2) BEGIN
      { rows: [] }, // (3) SAVEPOINT
      { rows: [] }, // (4) advisory lock
      {
        rows: [{ id: "prev-id", version_group: "grp-x", version_number: 2 }],
      }, // (5) findLatestByCode (tryInsert)
      {
        rows: [{ id: "prev-id", version_group: "grp-x", version_number: 2 }],
      }, // (6) findLatestByCode (version branch)
      {
        rows: [
          {
            description: "Inherit me",
            category_id: "cat-42",
            currency: "EUR",
            material_cost: "5.50",
            labour_cost: null,
            overhead_pct: null,
            margin_pct: null,
            client_rate: null,
            budget_rate: null,
            spec_reference: "SPEC-1",
            drawing_ref: null,
            tags: ["legacy"],
          },
        ],
      }, // (7) SELECT prev row
      { rows: [{ id: "new-id" }] }, // (8) INSERT
      { rows: [] }, // (9) attribute copy
      { rows: [] }, // (10) RELEASE
      { rows: [] }, // (11) COMMIT
    ]);

    await realBulkUpsertElements(ORG, {
      strategy: "version",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          code: "INHERIT-TEST",
          name: "Updated name",
          unit: "m2",
          unitCost: 99, // required always taken
          // description, currency, materialCost, specReference, tags all blank
        },
      ],
    });

    const insertCall = mocks.db.query.mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("INSERT INTO element") &&
        c[0].includes("version_group") &&
        c[0].includes("version_number")
    );
    const params = insertCall?.[1] as unknown[];
    // Param order per INSERT SQL: orgId, code, name, description, category_id,
    // unit, unit_cost, currency, material_cost, labour_cost, overhead_pct,
    // service_charge_pct, margin_pct, client_rate, budget_rate,
    // spec_reference, drawing_ref, tags, created_by, version_group, version_number
    expect(params[2]).toBe("Updated name"); // required, taken
    expect(params[3]).toBe("Inherit me"); // description inherited
    // Category is NOT inherited: a path is required on every row now, so the
    // new version is filed under the Service Area the sheet names, not the one
    // the previous version happened to carry.
    expect(params[4]).toBe("cat-3");
    expect(params[7]).toBe("EUR"); // currency inherited
    expect(params[8]).toBe("5.50"); // material_cost inherited
    expect(params[15]).toBe("SPEC-1"); // spec_reference inherited
    expect(params[17]).toEqual(["legacy"]); // tags inherited
  });
});

describe("bulkUpsertElements — overwrite strategy", () => {
  it("only updates the latest version in the group via ORDER BY LIMIT 1 subquery", async () => {
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // category tree
      { rows: [] }, // BEGIN
      { rows: [] }, // SAVEPOINT
      { rows: [] }, // advisory lock
      {
        rows: [
          {
            id: "existing-v5-id",
            version_group: "grp-2",
            version_number: 5,
          },
        ],
      }, // findLatestByCode in tryInsertElementRow (blocks the INSERT)
      { rows: [{ id: "existing-v5-id" }] }, // overwriteElementRow UPDATE
      { rows: [] }, // RELEASE SAVEPOINT
      { rows: [] }, // COMMIT
    ]);

    const result = await realBulkUpsertElements(ORG, {
      strategy: "overwrite",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          code: "WAL-PNT-001",
          name: "Updated Paint",
          unit: "m2",
          unitCost: 20,
        },
      ],
    });

    expect(result.updated).toBe(1);
    expect(result.failed).toEqual([]);

    // The overwrite UPDATE must target only the latest version — its WHERE
    // clause must select `ORDER BY version_number DESC LIMIT 1` so older
    // versions stay immutable.
    const updateCall = mocks.db.query.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("UPDATE element SET")
    );
    expect(updateCall).toBeDefined();
    const sql = updateCall?.[0] as string;
    expect(sql).toMatch(/ORDER BY version_number DESC/i);
    expect(sql).toMatch(/LIMIT 1/i);
  });
});

describe("bulkUpsertElements — skip strategy", () => {
  it("skips rows whose code already exists and counts them in `skipped`", async () => {
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // category tree
      { rows: [] }, // BEGIN
      { rows: [] }, // SAVEPOINT
      { rows: [] }, // advisory lock
      {
        rows: [
          {
            id: "existing-v1-id",
            version_group: "grp-3",
            version_number: 1,
          },
        ],
      }, // findLatestByCode returns existing → tryInsertElementRow returns null
      { rows: [] }, // RELEASE SAVEPOINT
      { rows: [] }, // COMMIT
    ]);

    const result = await realBulkUpsertElements(ORG, {
      strategy: "skip",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          code: "WAL-PNT-001",
          name: "Paint",
          unit: "m2",
          unitCost: 10,
        },
      ],
    });

    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.versioned).toBe(0);
    expect(result.failed).toEqual([]);
  });
});

describe("bulkUpsertElements — Service Area gate", () => {
  // The Zod schema can require a path, but only the org's tree knows whether it
  // names a Service Area. This is the last gate before the row is written.
  it("fails a row whose path resolves to a Sub-category, and writes nothing", async () => {
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // category tree
      { rows: [] }, // BEGIN
      { rows: [] }, // COMMIT
    ]);

    const result = await realBulkUpsertElements(ORG, {
      strategy: "skip",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: ["Kitchen", "Cabinets"], // level 2 — a real path, wrong level
          name: "Paint",
          unit: "m2",
          unitCost: 10,
        },
      ],
    });

    expect(result.inserted).toBe(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain("not a Service Area");

    // The row is rejected before any savepoint or insert is attempted.
    const wrote = mocks.db.query.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO element")
    );
    expect(wrote).toBe(false);
  });
});

describe("bulkUpsertElements — generated codes", () => {
  // A row with no code has no join key, so it can't match an existing element.
  // It is always a fresh insert, coded from its category's path code.
  it("generates a code for a row that supplies none", async () => {
    queueQueryResults([
      // The category tree is fetched once, and carries code_prefix + level —
      // so neither coding a row nor gating it on Service Area costs a per-row
      // category lookup.
      { rows: CATEGORY_ROWS },
      { rows: [] }, // BEGIN
      { rows: [] }, // SAVEPOINT
      { rows: [{ current_value: 7 }] }, // sequence_counter bump
      { rows: [] }, // advisory lock (candidate)
      { rows: [] }, // dup check → free
      { rows: [] }, // findLatestByCode → none
      { rows: [{ id: "new-row-id" }] }, // INSERT new element
      { rows: [] }, // RELEASE SAVEPOINT
      { rows: [] }, // COMMIT
    ]);

    const result = await realBulkUpsertElements(ORG, {
      strategy: "skip",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          name: "Paint",
          unit: "m2",
          unitCost: 10,
        },
      ],
    });

    expect(result.inserted).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toEqual([]);

    const insert = mocks.db.query.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO element\n")
    );
    // 4-digit sequence appended to the category's path code.
    expect((insert?.[1] as unknown[])[1]).toBe("KIT-CAB-BASE-0007");

    // The prefix came from the up-front category fetch. A per-row SELECT here
    // would be one extra round-trip for every row of a 10k-row import.
    const prefixLookups = mocks.db.query.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("SELECT code_prefix FROM element_category")
    );
    expect(prefixLookups).toHaveLength(0);
  });

  it("leaves a supplied code alone — it is the strategies' join key", async () => {
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // category tree
      { rows: [] }, // BEGIN
      { rows: [] }, // SAVEPOINT
      { rows: [] }, // advisory lock
      { rows: [] }, // findLatestByCode → none
      { rows: [{ id: "new-row-id" }] }, // INSERT new element
      { rows: [] }, // RELEASE SAVEPOINT
      { rows: [] }, // COMMIT
    ]);

    await realBulkUpsertElements(ORG, {
      strategy: "skip",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          code: "LEGACY-A-01",
          name: "Paint",
          unit: "m2",
          unitCost: 10,
        },
      ],
    });

    // No counter was touched — a coded row must round-trip byte for byte.
    const bumped = mocks.db.query.mock.calls.some(
      (c) => typeof c[0] === "string" && c[0].includes("sequence_counter")
    );
    expect(bumped).toBe(false);

    const insert = mocks.db.query.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO element\n")
    );
    expect((insert?.[1] as unknown[])[1]).toBe("LEGACY-A-01");
  });
});

describe("bulkUpsertElements — advisory-lock serialisation", () => {
  it("takes a pg_advisory_xact_lock keyed on (orgId, code) before the SELECT/INSERT", async () => {
    queueQueryResults([
      { rows: CATEGORY_ROWS }, // category tree
      { rows: [] }, // BEGIN
      { rows: [] }, // SAVEPOINT
      { rows: [] }, // advisory lock
      { rows: [] }, // findLatestByCode → none
      { rows: [{ id: "new-row-id" }] }, // INSERT new element
      { rows: [] }, // RELEASE SAVEPOINT
      { rows: [] }, // COMMIT
    ]);

    await realBulkUpsertElements(ORG, {
      strategy: "skip",
      createdBy: CREATED_BY,
      rows: [
        {
          rowNumber: 1,
          categoryPath: SERVICE_AREA_PATH,
          code: "CONCURRENT-CODE",
          name: "A",
          unit: "m2",
          unitCost: 1,
        },
      ],
    });

    const lockCall = mocks.db.query.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("pg_advisory_xact_lock")
    );
    expect(lockCall).toBeDefined();
    const lockKey = (lockCall?.[1] as unknown[])[0];
    // Key must bind both org id and code so unrelated codes don't contend.
    expect(lockKey).toBe(`element:${ORG}:CONCURRENT-CODE`);
  });
});
