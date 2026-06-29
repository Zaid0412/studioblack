import { describe, it, expect } from "vitest";
import {
  createRateContractSchema,
  updateRateContractSchema,
  addRateContractItemsSchema,
  parseBody,
} from "@/lib/validations";

const VENDOR_ID = "11111111-1111-4111-8111-111111111111";
const ELEMENT_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_ID = "44444444-4444-4444-8444-444444444444";

describe("createRateContractSchema", () => {
  const valid = {
    vendorId: VENDOR_ID,
    name: "Carpentry 2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  };

  it("accepts a minimal valid input", () => {
    expect(parseBody(createRateContractSchema, valid).success).toBe(true);
  });

  it("rejects endDate before startDate", () => {
    const r = parseBody(createRateContractSchema, {
      ...valid,
      startDate: "2026-12-31",
      endDate: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    const r = parseBody(createRateContractSchema, {
      ...valid,
      startDate: "01-01-2026",
    });
    expect(r.success).toBe(false);
  });

  it("rejects 4-letter currency", () => {
    const r = parseBody(createRateContractSchema, {
      ...valid,
      currency: "USDX",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid agreementUrl", () => {
    const r = parseBody(createRateContractSchema, {
      ...valid,
      agreementUrl: "https://example.com/agreement.pdf",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-URL agreementUrl", () => {
    const r = parseBody(createRateContractSchema, {
      ...valid,
      agreementUrl: "not a url",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateRateContractSchema", () => {
  it("accepts an empty patch", () => {
    expect(parseBody(updateRateContractSchema, {}).success).toBe(true);
  });

  it("accepts a status-only patch", () => {
    expect(
      parseBody(updateRateContractSchema, { status: "cancelled" }).success
    ).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      parseBody(updateRateContractSchema, { status: "expired_late" }).success
    ).toBe(false);
  });

  it("rejects when both dates are present and inverted", () => {
    expect(
      parseBody(updateRateContractSchema, {
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      }).success
    ).toBe(false);
  });

  it("accepts when only one date is present", () => {
    expect(
      parseBody(updateRateContractSchema, { endDate: "2026-12-31" }).success
    ).toBe(true);
  });
});

describe("addRateContractItemsSchema", () => {
  const valid = {
    items: [
      { categoryId: CATEGORY_ID, elementId: ELEMENT_ID, unit: "no", rate: 100 },
    ],
  };

  it("accepts a minimal valid items array", () => {
    expect(parseBody(addRateContractItemsSchema, valid).success).toBe(true);
  });

  it("accepts a service-area-only item (no element)", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [{ categoryId: CATEGORY_ID, unit: "no", rate: 100 }],
      }).success
    ).toBe(true);
  });

  it("rejects an item with no service area (categoryId)", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [{ elementId: ELEMENT_ID, unit: "no", rate: 100 }],
      }).success
    ).toBe(false);
  });

  it("rejects empty items array", () => {
    expect(parseBody(addRateContractItemsSchema, { items: [] }).success).toBe(
      false
    );
  });

  it("rejects negative rate", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [{ categoryId: CATEGORY_ID, unit: "no", rate: -1 }],
      }).success
    ).toBe(false);
  });

  it("rejects zero rate", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [{ categoryId: CATEGORY_ID, unit: "no", rate: 0 }],
      }).success
    ).toBe(false);
  });

  it("rejects unknown unit", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [{ categoryId: CATEGORY_ID, unit: "shells", rate: 1 }],
      }).success
    ).toBe(false);
  });
});
