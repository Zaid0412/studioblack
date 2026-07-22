import { describe, it, expect, beforeEach, vi } from "vitest";
// Submodules (not the `@/lib/queries` barrel) aren't mocked in setup, so these
// are the real implementations; `getPool` is mocked via `@/lib/db`.
import { normalizeEmail } from "@/lib/queries/vendors";
import { getRfqContactsForEmail } from "@/lib/queries/rfqs";
import { mocks } from "../setup";

describe("normalizeEmail", () => {
  it("trims and lowercases so duplicates collapse", () => {
    expect(normalizeEmail("  A@X.com ")).toBe("a@x.com");
    expect(normalizeEmail("Foo.Bar@Example.COM")).toBe("foo.bar@example.com");
    expect(normalizeEmail("ops@acme.com")).toBe("ops@acme.com");
  });
});

describe("getRfqContactsForEmail — recipient de-dup", () => {
  beforeEach(() => vi.clearAllMocks());

  const row = (over: Record<string, unknown>) => ({
    vendor_id: "v1",
    vendor_name: "Acme",
    contact_id: "c1",
    contact_name: "A",
    contact_email: "ops@acme.com",
    contact_user_id: null,
    ...over,
  });

  it("collapses same-address contacts within a vendor, keeps distinct vendors", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [
        row({ contact_id: "c1", contact_email: "ops@acme.com" }),
        // Same inbox, different case/whitespace — must not double-send.
        row({
          contact_id: "c2",
          contact_name: "B",
          contact_email: "OPS@acme.com ",
        }),
        // Same address but a different vendor — kept.
        row({ vendor_id: "v2", vendor_name: "Beta", contact_id: "c3" }),
      ],
    });

    const out = await getRfqContactsForEmail("rfq1");

    expect(out.map((r) => r.contactId)).toEqual(["c1", "c3"]);
  });

  it("keeps genuinely different addresses for one vendor", async () => {
    mocks.db.query.mockResolvedValueOnce({
      rows: [
        row({ contact_id: "c1", contact_email: "a@acme.com" }),
        row({ contact_id: "c2", contact_email: "b@acme.com" }),
      ],
    });

    const out = await getRfqContactsForEmail("rfq1");

    expect(out.map((r) => r.contactId)).toEqual(["c1", "c2"]);
  });
});
