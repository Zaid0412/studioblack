import { describe, it, expect } from "vitest";
import {
  vendorKycDocumentSchema,
  vendorKycStatusSchema,
  parseBody,
} from "@/lib/validations";

describe("vendorKycDocumentSchema", () => {
  const valid = {
    docType: "trade_licence" as const,
    fileUrl: "https://example.com/file.pdf",
    fileName: "file.pdf",
  };

  it("accepts a minimal valid input", () => {
    const r = parseBody(vendorKycDocumentSchema, valid);
    expect(r.success).toBe(true);
  });

  it("accepts an ISO date for expiresAt", () => {
    const r = parseBody(vendorKycDocumentSchema, {
      ...valid,
      expiresAt: "2026-12-31",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed expiresAt", () => {
    const r = parseBody(vendorKycDocumentSchema, {
      ...valid,
      expiresAt: "31/12/2026",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown docType", () => {
    const r = parseBody(vendorKycDocumentSchema, {
      ...valid,
      docType: "passport",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty fileUrl", () => {
    const r = parseBody(vendorKycDocumentSchema, { ...valid, fileUrl: "" });
    expect(r.success).toBe(false);
  });
});

describe("vendorKycStatusSchema", () => {
  it("accepts each known status", () => {
    for (const s of [
      "unverified",
      "pending",
      "verified",
      "rejected",
    ] as const) {
      const r = parseBody(vendorKycStatusSchema, { kycStatus: s });
      expect(r.success).toBe(true);
    }
  });

  it("rejects unknown status", () => {
    const r = parseBody(vendorKycStatusSchema, { kycStatus: "expired" });
    expect(r.success).toBe(false);
  });

  it("accepts optional notes", () => {
    const r = parseBody(vendorKycStatusSchema, {
      kycStatus: "verified",
      kycNotes: "All clear",
    });
    expect(r.success).toBe(true);
  });
});
