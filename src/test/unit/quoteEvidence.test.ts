/**
 * Quote evidence (§15): the client-facing schema must strip server-owned
 * provenance, and `stampQuoteEvidence` must stamp new files while preserving the
 * original uploader/date/source across revisions.
 */
import { describe, it, expect, vi } from "vitest";
import { quoteEvidenceSchema } from "@/lib/validations";
import type { QuoteEvidenceInput } from "@/lib/validations";
import type { QuoteEvidence } from "@/types";

// stampQuoteEvidence lives in the globally-mocked @/lib/queries — load the real one.
async function stamp(
  input: QuoteEvidenceInput[],
  prior: QuoteEvidence[],
  opts: Parameters<typeof import("@/lib/queries/quotes").stampQuoteEvidence>[2]
) {
  const actual = await vi.importActual<typeof import("@/lib/queries/quotes")>(
    "@/lib/queries/quotes"
  );
  return actual.stampQuoteEvidence(input, prior, opts);
}

describe("quoteEvidenceSchema", () => {
  it("accepts the client-facing evidence fields", () => {
    const r = quoteEvidenceSchema.safeParse({
      url: "https://x.co/a.pdf",
      fileName: "a.pdf",
      fileType: "pdf",
      notes: "emailed scan",
    });
    expect(r.success).toBe(true);
  });

  it("strips server-owned provenance a client tries to supply", () => {
    const r = quoteEvidenceSchema.parse({
      url: "https://x.co/a.pdf",
      fileName: "a.pdf",
      uploadedBy: "hacker",
      uploadedAt: "2020-01-01",
      source: "portal",
    } as never);
    expect(r).not.toHaveProperty("uploadedBy");
    expect(r).not.toHaveProperty("uploadedAt");
    expect(r).not.toHaveProperty("source");
  });

  it("rejects a non-url", () => {
    expect(
      quoteEvidenceSchema.safeParse({ url: "notaurl", fileName: "a" }).success
    ).toBe(false);
  });
});

describe("stampQuoteEvidence", () => {
  const opts = {
    uploaderId: "user-1",
    source: "email" as const,
    at: "2026-07-06T00:00:00.000Z",
  };

  it("stamps new files with uploader / date / source", async () => {
    const out = await stamp(
      [{ url: "u1", fileName: "f1.pdf", fileType: "pdf", notes: "n1" }],
      [],
      opts
    );
    expect(out).toEqual([
      {
        url: "u1",
        fileName: "f1.pdf",
        fileType: "pdf",
        notes: "n1",
        uploadedBy: "user-1",
        uploadedAt: "2026-07-06T00:00:00.000Z",
        source: "email",
      },
    ]);
  });

  it("preserves original provenance across a revision, stamps only new files", async () => {
    const prior: QuoteEvidence[] = [
      {
        url: "u1",
        fileName: "f1.pdf",
        uploadedBy: "orig-user",
        uploadedAt: "2026-01-01T00:00:00.000Z",
        source: "whatsapp",
      },
    ];
    const out = await stamp(
      [
        { url: "u1", fileName: "f1.pdf", notes: "edited note" }, // existed → keep provenance
        { url: "u2", fileName: "f2.pdf" }, // new → stamp now
      ],
      prior,
      opts
    );
    expect(out[0]).toMatchObject({
      uploadedBy: "orig-user",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      source: "whatsapp",
      notes: "edited note",
    });
    expect(out[1]).toMatchObject({
      uploadedBy: "user-1",
      uploadedAt: "2026-07-06T00:00:00.000Z",
      source: "email",
    });
  });
});
