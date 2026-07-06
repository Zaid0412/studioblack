import { describe, it, expect } from "vitest";
import { serializeQuoteDraft } from "@/lib/quoteDraft";

describe("serializeQuoteDraft", () => {
  const base = {
    source: "email",
    receivedDate: "2026-01-10",
    currency: "USD",
    validUntil: "2026-02-01",
    deliveryPeriod: "4 weeks",
    paymentTerms: "50% advance",
    notes: "hello",
    prices: [100, null, 250] as Array<number | null>,
    attachments: [{ url: "https://x/a.pdf", notes: "spec" }],
  };

  it("is stable for identical drafts", () => {
    expect(serializeQuoteDraft(base)).toBe(serializeQuoteDraft({ ...base }));
  });

  it("changes when a unit price changes", () => {
    expect(serializeQuoteDraft({ ...base, prices: [100, null, 999] })).not.toBe(
      serializeQuoteDraft(base)
    );
  });

  it("changes when a field like notes changes", () => {
    expect(serializeQuoteDraft({ ...base, notes: "bye" })).not.toBe(
      serializeQuoteDraft(base)
    );
  });

  it("changes when an attachment note changes", () => {
    expect(
      serializeQuoteDraft({
        ...base,
        attachments: [{ url: "https://x/a.pdf", notes: "revised" }],
      })
    ).not.toBe(serializeQuoteDraft(base));
  });

  it("ignores attachment fields other than url + notes", () => {
    const withExtra = serializeQuoteDraft({
      ...base,
      attachments: [
        {
          url: "https://x/a.pdf",
          notes: "spec",
          // extra keys a caller might spread in — must not affect the result
          fileName: "a.pdf",
          fileType: "pdf",
        } as { url: string; notes: string },
      ],
    });
    expect(withExtra).toBe(serializeQuoteDraft(base));
  });

  it("collapses absent optional fields to stable defaults (portal parity)", () => {
    // A portal draft omits source/receivedDate/currency; a studio draft that
    // explicitly nulls them must serialise identically given the same rest.
    const portal = serializeQuoteDraft({
      validUntil: null,
      deliveryPeriod: "",
      paymentTerms: "",
      notes: "",
      prices: [100],
      attachments: [],
    });
    const studio = serializeQuoteDraft({
      source: undefined,
      receivedDate: null,
      currency: undefined,
      validUntil: null,
      deliveryPeriod: "",
      paymentTerms: "",
      notes: "",
      prices: [100],
      attachments: [],
    });
    expect(portal).toBe(studio);
  });

  it("treats missing notes on an attachment as empty", () => {
    expect(
      serializeQuoteDraft({
        ...base,
        attachments: [{ url: "https://x/a.pdf" }],
      })
    ).toBe(
      serializeQuoteDraft({
        ...base,
        attachments: [{ url: "https://x/a.pdf", notes: "" }],
      })
    );
  });
});
