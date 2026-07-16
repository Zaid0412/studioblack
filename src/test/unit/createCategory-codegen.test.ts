import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `createCategory` generates the code_prefix from the name when the org
 * auto-generates and none is supplied, dedupes it against siblings, and rejects
 * a supplied code that collides. We run the real query fn against a shape-routed
 * pooled client.
 */
const { mockQuery, mockConnect } = vi.hoisted(() => {
  const q = vi.fn();
  return {
    mockQuery: q,
    mockConnect: vi.fn(() => Promise.resolve({ query: q, release: vi.fn() })),
  };
});
vi.mock("@/lib/db", () => ({
  getPool: () => ({ query: mockQuery, connect: mockConnect }),
}));

import {
  createCategory,
  updateCategory,
  DuplicateCodeError,
  CategoryCodeLockedError,
} from "@/lib/queries/elementCategories";

/** Route the query mock. `config` and `siblings` are per-test. */
function wire(opts: { config?: Record<string, unknown>; siblings?: string[] }) {
  mockQuery.mockImplementation((sql: string) => {
    if (/FROM category_code_config/.test(sql))
      return Promise.resolve({ rows: opts.config ? [opts.config] : [] });
    if (/FROM element_category[\s\S]*FOR UPDATE/.test(sql))
      return Promise.resolve({
        rows: (opts.siblings ?? []).map((code_prefix) => ({ code_prefix })),
      });
    if (/INSERT INTO element_category/.test(sql))
      return Promise.resolve({ rows: [{ id: "new", code_prefix: "x" }] });
    return Promise.resolve({ rows: [] }); // BEGIN / lock / COMMIT / ROLLBACK
  });
}

/** The code_prefix ($4) passed to the INSERT. */
const insertedCode = () =>
  (
    mockQuery.mock.calls.find((c) =>
      /INSERT INTO element_category/.test(String(c[0]))
    )?.[1] as unknown[]
  )?.[3];

beforeEach(() => mockQuery.mockReset());

describe("createCategory — code auto-generation", () => {
  it("generates a code from the name when none is supplied (auto on)", async () => {
    wire({});
    await createCategory("org-1", { name: "Kitchen" });
    // First alphanumeric word, capped at the default 4.
    expect(insertedCode()).toBe("KITC");
  });

  it("dedupes the generated code against siblings", async () => {
    wire({ siblings: ["KITC"] });
    await createCategory("org-1", { name: "Kitchen" });
    const code = insertedCode();
    expect(code).not.toBe("KITC");
    expect(String(code).startsWith("KIT")).toBe(true);
  });

  it("leaves the code null in manual mode (auto off, none supplied)", async () => {
    wire({
      config: {
        auto_generate: false,
        code_max_length: 4,
        force_uppercase: true,
        prevent_duplicates: true,
        lock_after_use: true,
      },
    });
    await createCategory("org-1", { name: "Kitchen" });
    expect(insertedCode()).toBeNull();
  });

  it("rejects a supplied code that collides with a sibling", async () => {
    wire({ siblings: ["KIT"] });
    await expect(
      createCategory("org-1", { name: "Kitchen", codePrefix: "KIT" })
    ).rejects.toBeInstanceOf(DuplicateCodeError);
  });
});

describe("updateCategory — lock after use", () => {
  /** Route the update path: before-row, config, and the in-use EXISTS check. */
  function wireUpdate(opts: { inUse: boolean; lockAfterUse?: boolean }) {
    mockQuery.mockImplementation((sql: string) => {
      if (/SELECT code_prefix, parent_id FROM element_category/.test(sql))
        return Promise.resolve({
          rows: [{ code_prefix: "OLD", parent_id: null }],
        });
      if (/FROM category_code_config/.test(sql))
        return Promise.resolve({
          rows:
            opts.lockAfterUse === false
              ? [
                  {
                    auto_generate: true,
                    code_max_length: 4,
                    force_uppercase: true,
                    prevent_duplicates: true,
                    lock_after_use: false,
                  },
                ]
              : [], // default: lock_after_use = true
        });
      if (/SELECT EXISTS/.test(sql))
        return Promise.resolve({ rows: [{ referenced: opts.inUse }] });
      if (/UPDATE element_category/.test(sql))
        return Promise.resolve({ rows: [{ id: "cat-1", code_prefix: "NEW" }] });
      return Promise.resolve({ rows: [] }); // BEGIN / lock / COMMIT / ROLLBACK
    });
  }

  it("blocks a code change on an in-use category", async () => {
    wireUpdate({ inUse: true });
    await expect(
      updateCategory("cat-1", "org-1", { code_prefix: "NEW" })
    ).rejects.toBeInstanceOf(CategoryCodeLockedError);
  });

  it("allows a code change when the category isn't in use", async () => {
    wireUpdate({ inUse: false });
    const res = await updateCategory("cat-1", "org-1", { code_prefix: "NEW" });
    expect(res?.code_prefix).toBe("NEW");
  });

  it("allows a code change on an in-use category when lock is off", async () => {
    wireUpdate({ inUse: true, lockAfterUse: false });
    const res = await updateCategory("cat-1", "org-1", { code_prefix: "NEW" });
    expect(res?.code_prefix).toBe("NEW");
  });
});
