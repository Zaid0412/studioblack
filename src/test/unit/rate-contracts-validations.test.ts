import { describe, it, expect } from "vitest";
import {
  createRateContractSchema,
  updateRateContractSchema,
  addRateContractItemsSchema,
  transitionRateContractSchema,
  RATE_CONTRACT_ACTIONS,
  RATE_CONTRACT_STATUSES,
  RATE_CONTRACT_TRANSITIONS,
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

  it("accepts contract type, price basis, and commercial terms", () => {
    expect(
      parseBody(createRateContractSchema, {
        ...valid,
        contractType: "mixed",
        priceBasis: "supply_install",
        creditPeriodDays: 30,
        deliveryTerms: "Ex-site",
        renewalDate: "2026-12-15",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown contract type", () => {
    expect(
      parseBody(createRateContractSchema, { ...valid, contractType: "bogus" })
        .success
    ).toBe(false);
  });

  it("rejects a negative credit period", () => {
    expect(
      parseBody(createRateContractSchema, { ...valid, creditPeriodDays: -1 })
        .success
    ).toBe(false);
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

  it("strips status — it moves only through transitions, not header edits", () => {
    const r = parseBody(updateRateContractSchema, {
      name: "X",
      status: "cancelled",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>).status).toBeUndefined();
    }
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

describe("transitionRateContractSchema", () => {
  it("accepts a known action", () => {
    expect(
      parseBody(transitionRateContractSchema, { action: "approve" }).success
    ).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(
      parseBody(transitionRateContractSchema, { action: "frobnicate" }).success
    ).toBe(false);
  });

  it("rejects a missing action", () => {
    expect(parseBody(transitionRateContractSchema, {}).success).toBe(false);
  });

  it("accepts an optional reviewer note", () => {
    expect(
      parseBody(transitionRateContractSchema, {
        action: "request_changes",
        note: "Fix the end date",
      }).success
    ).toBe(true);
  });
});

describe("RATE_CONTRACT_TRANSITIONS (state machine)", () => {
  it("uses only valid statuses and never self-loops", () => {
    for (const action of RATE_CONTRACT_ACTIONS) {
      const t = RATE_CONTRACT_TRANSITIONS[action];
      expect(RATE_CONTRACT_STATUSES).toContain(t.to);
      for (const from of t.from) {
        expect(RATE_CONTRACT_STATUSES).toContain(from);
      }
      expect(t.from).not.toContain(t.to);
    }
  });

  it("gates only approve + request_changes behind PM", () => {
    const pmOnly = RATE_CONTRACT_ACTIONS.filter(
      (a) => RATE_CONTRACT_TRANSITIONS[a].pmOnly
    );
    expect([...pmOnly].sort()).toEqual(["approve", "request_changes"]);
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

  it("accepts the optional procurement fields", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [
          {
            categoryId: CATEGORY_ID,
            unit: "no",
            rate: 100,
            description: "Base cabinet supply",
            minQty: 20,
            maxQty: 500,
            leadTimeDays: 21,
            validUntil: "2026-12-31",
          },
        ],
      }).success
    ).toBe(true);
  });

  it("rejects maxQty below minQty", () => {
    expect(
      parseBody(addRateContractItemsSchema, {
        items: [
          {
            categoryId: CATEGORY_ID,
            unit: "no",
            rate: 100,
            minQty: 50,
            maxQty: 10,
          },
        ],
      }).success
    ).toBe(false);
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
