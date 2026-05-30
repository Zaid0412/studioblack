import { describe, it, expect } from "vitest";
import {
  createVendorSchema,
  updateVendorSchema,
  vendorContactSchema,
  vendorTradeSchema,
  vendorAddressSchema,
  bankDetailsSchema,
  vendorRatingSchema,
  listVendorsQuerySchema,
} from "@/lib/validations";

const validUuid = "00000000-0000-4000-8000-000000000001";

// ─── createVendorSchema ─────────────────────────────────────────────────────

describe("createVendorSchema", () => {
  it("accepts a minimal valid vendor", () => {
    const result = createVendorSchema.safeParse({ companyName: "Acme Co" });
    expect(result.success).toBe(true);
  });

  it("rejects empty companyName", () => {
    const result = createVendorSchema.safeParse({ companyName: "  " });
    expect(result.success).toBe(false);
  });

  it("accepts nested contacts and trades", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme Co",
      contacts: [
        { name: "Alice", email: "alice@acme.com", isPrimary: true },
        { name: "Bob", email: "bob@acme.com" },
      ],
      trades: [{ categoryId: validUuid, proficiencyLevel: "preferred" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email in contact", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme Co",
      contacts: [{ name: "Alice", email: "not-an-email" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme Co",
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });

  it("enforces 3-letter currency", () => {
    expect(
      createVendorSchema.safeParse({ companyName: "X", currency: "USDD" })
        .success
    ).toBe(false);
    expect(
      createVendorSchema.safeParse({ companyName: "X", currency: "USD" })
        .success
    ).toBe(true);
  });

  it("enforces contact array max", () => {
    const contacts = Array.from({ length: 21 }, (_, i) => ({
      name: `c${i}`,
      email: `c${i}@x.com`,
    }));
    expect(
      createVendorSchema.safeParse({ companyName: "X", contacts }).success
    ).toBe(false);
  });
});

// ─── updateVendorSchema ─────────────────────────────────────────────────────

describe("updateVendorSchema", () => {
  it("accepts an empty patch", () => {
    expect(updateVendorSchema.safeParse({}).success).toBe(true);
  });

  it("accepts nullable fields to clear them", () => {
    const result = updateVendorSchema.safeParse({
      tradingName: null,
      paymentTerms: null,
      addresses: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects rating field (should use rating endpoint)", () => {
    const result = updateVendorSchema.safeParse({ rating: 4.5 });
    expect(result.success).toBe(true); // Zod by default allows extra keys; ensure it's not parsed
    if (result.success) {
      expect("rating" in result.data).toBe(false);
    }
  });
});

// ─── vendorContactSchema ────────────────────────────────────────────────────

describe("vendorContactSchema", () => {
  it("requires name and email", () => {
    expect(vendorContactSchema.safeParse({ email: "x@y.com" }).success).toBe(
      false
    );
    expect(vendorContactSchema.safeParse({ name: "X" }).success).toBe(false);
    expect(
      vendorContactSchema.safeParse({ name: "X", email: "x@y.com" }).success
    ).toBe(true);
  });
});

// ─── vendorTradeSchema ──────────────────────────────────────────────────────

describe("vendorTradeSchema", () => {
  it("requires a uuid categoryId", () => {
    expect(
      vendorTradeSchema.safeParse({ categoryId: "not-uuid" }).success
    ).toBe(false);
    expect(vendorTradeSchema.safeParse({ categoryId: validUuid }).success).toBe(
      true
    );
  });

  it("rejects invalid proficiency levels", () => {
    expect(
      vendorTradeSchema.safeParse({
        categoryId: validUuid,
        proficiencyLevel: "expert",
      }).success
    ).toBe(false);
  });
});

// ─── vendorAddressSchema ────────────────────────────────────────────────────

describe("vendorAddressSchema", () => {
  it("rejects unknown keys via .strict()", () => {
    const result = vendorAddressSchema.safeParse({ foo: "bar" });
    expect(result.success).toBe(false);
  });

  it("accepts a partial address", () => {
    expect(
      vendorAddressSchema.safeParse({ city: "London", country: "UK" }).success
    ).toBe(true);
  });
});

// ─── bankDetailsSchema ──────────────────────────────────────────────────────

describe("bankDetailsSchema", () => {
  it("accepts partial details", () => {
    expect(bankDetailsSchema.safeParse({ iban: "GB29NWBK..." }).success).toBe(
      true
    );
  });

  it("rejects unknown keys via .strict()", () => {
    const result = bankDetailsSchema.safeParse({ password: "secret" });
    expect(result.success).toBe(false);
  });
});

// ─── vendorRatingSchema ─────────────────────────────────────────────────────

describe("vendorRatingSchema", () => {
  it.each([0, 0.5, 1, 2.5, 5])("accepts %s", (n) => {
    expect(vendorRatingSchema.safeParse({ rating: n }).success).toBe(true);
  });

  it.each([-1, 5.5, 0.3, 2.7])("rejects %s", (n) => {
    expect(vendorRatingSchema.safeParse({ rating: n }).success).toBe(false);
  });
});

// ─── listVendorsQuerySchema ─────────────────────────────────────────────────

describe("listVendorsQuerySchema", () => {
  it("coerces strings to numbers for page/limit", () => {
    const result = listVendorsQuerySchema.safeParse({ page: "2", limit: "10" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
    }
  });

  it("applies sane defaults", () => {
    const result = listVendorsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit > 200", () => {
    expect(listVendorsQuerySchema.safeParse({ limit: 500 }).success).toBe(
      false
    );
  });

  it("rejects unknown status", () => {
    expect(
      listVendorsQuerySchema.safeParse({ status: "deleted" }).success
    ).toBe(false);
  });
});

// ─── Multi-address + secondary contact + dropped tax_id ────────────────────

describe("createVendorSchema — multi-address + tax_id removed", () => {
  it("accepts multiple addresses with labels and is_primary", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      addresses: [
        { label: "HQ", line1: "1 Main", city: "Istanbul", is_primary: true },
        { label: "Warehouse", line1: "12 Dock Rd", city: "Bodrum" },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addresses).toHaveLength(2);
    }
  });

  it("strips taxId — the field is gone from the schema", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      taxId: "ABC123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("taxId" in result.data).toBe(false);
    }
  });

  it("rejects more than 10 addresses", () => {
    const addresses = Array.from({ length: 11 }, () => ({ city: "X" }));
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      addresses,
    });
    expect(result.success).toBe(false);
  });
});

describe("vendorContactSchema — secondary slot", () => {
  it("accepts a secondary-only contact", () => {
    const result = vendorContactSchema.safeParse({
      name: "Jane",
      email: "jane@acme.com",
      isSecondary: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a contact marked both Main and Secondary", () => {
    const result = vendorContactSchema.safeParse({
      name: "Jane",
      email: "jane@acme.com",
      isPrimary: true,
      isSecondary: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toMatch(/Main.*Secondary/);
    }
  });
});

describe("vendorAddressSchema — label + is_primary", () => {
  it("accepts an optional label and is_primary flag", () => {
    const result = vendorAddressSchema.safeParse({
      label: "HQ",
      city: "Istanbul",
      is_primary: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Vendor field expansion (GSTIN, website, preferred, brands, areas, IFSC) ─

describe("createVendorSchema — expanded fields", () => {
  it("accepts gstin, website, preferredVendor, brandsSupported, serviceAreas", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      gstin: "29ABCDE1234F1Z5",
      website: "https://acme.example",
      preferredVendor: true,
      brandsSupported: ["Asian Paints", "Jaquar"],
      serviceAreas: ["Bengaluru", "Chennai"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gstin).toBe("29ABCDE1234F1Z5");
      expect(result.data.preferredVendor).toBe(true);
      expect(result.data.brandsSupported).toHaveLength(2);
      expect(result.data.serviceAreas).toHaveLength(2);
    }
  });

  it("rejects website without a protocol scheme", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      website: "acme.example",
    });
    expect(result.success).toBe(false);
  });

  it("rejects gstin longer than 20 chars", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      gstin: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 brands", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      brandsSupported: Array.from({ length: 51 }, (_, i) => `Brand ${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty strings in service areas", () => {
    const result = createVendorSchema.safeParse({
      companyName: "Acme",
      serviceAreas: [""],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateVendorSchema — expanded fields", () => {
  it("accepts nullable gstin and website to clear them", () => {
    const result = updateVendorSchema.safeParse({
      gstin: null,
      website: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("bankDetailsSchema — IFSC", () => {
  it("accepts an ifsc_code value", () => {
    const result = bankDetailsSchema.safeParse({
      account_number: "1234567890",
      ifsc_code: "HDFC0001234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects ifsc_code longer than 20 chars", () => {
    const result = bankDetailsSchema.safeParse({
      ifsc_code: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});
