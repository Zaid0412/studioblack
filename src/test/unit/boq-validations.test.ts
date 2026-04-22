import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  createBoqSchema,
  updateBoqSchema,
  createBoqSectionSchema,
  updateBoqSectionSchema,
  reorderSectionsSchema,
  createBoqItemSchema,
  updateBoqItemSchema,
  deleteBoqItemSchema,
  reorderItemsSchema,
  addElementToBoqSchema,
  parseBody,
} from "@/lib/validations";

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440001";

function expectPass<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = parseBody(schema, data);
  expect(result.success).toBe(true);
  return (result as { success: true; data: z.infer<T> }).data;
}

function expectFail(schema: z.ZodType, data: unknown): string {
  const result = parseBody(schema, data);
  expect(result.success).toBe(false);
  return (result as { success: false; error: string }).error;
}

// ── createBoqSchema ──────────────────────────────────────────────────────────

describe("createBoqSchema", () => {
  it("accepts minimal valid input", () => {
    const data = expectPass(createBoqSchema, { title: "Main BOQ" });
    expect(data.title).toBe("Main BOQ");
  });

  it("trims the title", () => {
    const data = expectPass(createBoqSchema, { title: "  Padded  " });
    expect(data.title).toBe("Padded");
  });

  it("accepts all optional fields", () => {
    const data = expectPass(createBoqSchema, {
      title: "Main BOQ",
      currency: "INR",
      exchangeRate: 82.5,
      contingencyPct: 5,
      vatPct: 18,
      minimumMarginPct: 12,
      notes: "Q1 BOQ",
      clientNotes: null,
    });
    expect(data.currency).toBe("INR");
    expect(data.exchangeRate).toBe(82.5);
    expect(data.contingencyPct).toBe(5);
  });

  it("coerces numeric percentages from strings", () => {
    const data = expectPass(createBoqSchema, {
      title: "X",
      contingencyPct: "7.5",
    });
    expect(data.contingencyPct).toBe(7.5);
  });

  it("rejects empty title", () => {
    expectFail(createBoqSchema, { title: "" });
  });

  it("rejects currency that isn't 3 chars", () => {
    expectFail(createBoqSchema, { title: "X", currency: "USDOLLAR" });
    expectFail(createBoqSchema, { title: "X", currency: "US" });
  });

  it("rejects percentages below 0 or above 100", () => {
    expectFail(createBoqSchema, { title: "X", contingencyPct: -1 });
    expectFail(createBoqSchema, { title: "X", vatPct: 101 });
    expectFail(createBoqSchema, { title: "X", minimumMarginPct: 150 });
  });

  it("rejects non-positive exchangeRate", () => {
    expectFail(createBoqSchema, { title: "X", exchangeRate: 0 });
    expectFail(createBoqSchema, { title: "X", exchangeRate: -1 });
  });
});

// ── updateBoqSchema ──────────────────────────────────────────────────────────

describe("updateBoqSchema", () => {
  it("accepts an empty object", () => {
    const data = expectPass(updateBoqSchema, {});
    expect(data).toEqual({});
  });

  it("accepts a subset of fields", () => {
    const data = expectPass(updateBoqSchema, {
      title: "Renamed",
      vatPct: 20,
    });
    expect(data.title).toBe("Renamed");
    expect(data.vatPct).toBe(20);
  });

  it("rejects invalid percentages", () => {
    expectFail(updateBoqSchema, { contingencyPct: -1 });
    expectFail(updateBoqSchema, { vatPct: 200 });
  });
});

// ── createBoqSectionSchema ───────────────────────────────────────────────────

describe("createBoqSectionSchema", () => {
  it("accepts a minimal valid section", () => {
    const data = expectPass(createBoqSectionSchema, { title: "Civil" });
    expect(data.title).toBe("Civil");
  });

  it("accepts budgetCap as null", () => {
    const data = expectPass(createBoqSectionSchema, {
      title: "Civil",
      budgetCap: null,
    });
    expect(data.budgetCap).toBeNull();
  });

  it("rejects a negative budgetCap", () => {
    expectFail(createBoqSectionSchema, {
      title: "Civil",
      budgetCap: -100,
    });
  });

  it("rejects empty title", () => {
    expectFail(createBoqSectionSchema, { title: "" });
  });

  it("rejects negative sortOrder", () => {
    expectFail(createBoqSectionSchema, { title: "X", sortOrder: -1 });
  });
});

// ── updateBoqSectionSchema ───────────────────────────────────────────────────

describe("updateBoqSectionSchema", () => {
  it("accepts partial updates", () => {
    expectPass(updateBoqSectionSchema, { title: "Renamed" });
    expectPass(updateBoqSectionSchema, { isVisibleToClient: false });
    expectPass(updateBoqSectionSchema, { budgetCap: null });
  });

  it("rejects empty title", () => {
    expectFail(updateBoqSectionSchema, { title: "" });
  });
});

// ── reorderSectionsSchema ────────────────────────────────────────────────────

describe("reorderSectionsSchema", () => {
  it("accepts a non-empty array of UUIDs", () => {
    const data = expectPass(reorderSectionsSchema, {
      orderedIds: [VALID_UUID, VALID_UUID_2],
    });
    expect(data.orderedIds).toHaveLength(2);
  });

  it("rejects an empty array", () => {
    expectFail(reorderSectionsSchema, { orderedIds: [] });
  });

  it("rejects non-UUID ids", () => {
    expectFail(reorderSectionsSchema, { orderedIds: ["not-a-uuid"] });
  });
});

// ── createBoqItemSchema ──────────────────────────────────────────────────────

describe("createBoqItemSchema", () => {
  it("accepts minimal valid input", () => {
    const data = expectPass(createBoqItemSchema, {
      description: "Tile laying",
      unit: "m2",
    });
    expect(data.description).toBe("Tile laying");
  });

  it("accepts all optional cost fields", () => {
    const data = expectPass(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      quantity: 100,
      unitCost: 25.5,
      materialCost: 15,
      labourCost: 10.5,
      overheadPct: 5,
      marginPct: 20,
      isProvisional: true,
    });
    expect(data.unitCost).toBe(25.5);
    expect(data.marginPct).toBe(20);
  });

  it("coerces numeric strings for money and quantity", () => {
    const data = expectPass(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      quantity: "10.5",
      unitCost: "99.99",
    });
    expect(data.quantity).toBe(10.5);
    expect(data.unitCost).toBe(99.99);
  });

  it("accepts null cost fields", () => {
    expectPass(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      materialCost: null,
      labourCost: null,
    });
  });

  it("rejects empty description", () => {
    expectFail(createBoqItemSchema, { description: "", unit: "m2" });
  });

  it("rejects empty unit", () => {
    expectFail(createBoqItemSchema, { description: "X", unit: "" });
  });

  it("rejects negative quantity or unitCost", () => {
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      quantity: -1,
    });
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      unitCost: -1,
    });
  });

  it("rejects overheadPct / marginPct out of 0–100", () => {
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      overheadPct: 101,
    });
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      marginPct: -5,
    });
  });

  it("rejects non-UUID sectionId and elementId", () => {
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      sectionId: "nope",
    });
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      elementId: "nope",
    });
  });

  it("rejects itemCode longer than 50 chars", () => {
    expectFail(createBoqItemSchema, {
      description: "X",
      unit: "m2",
      itemCode: "a".repeat(51),
    });
  });
});

// ── updateBoqItemSchema ──────────────────────────────────────────────────────

describe("updateBoqItemSchema", () => {
  it("requires the updatedAt optimistic-lock token", () => {
    expectFail(updateBoqItemSchema, { quantity: 5 });
  });

  it("rejects empty updatedAt string", () => {
    expectFail(updateBoqItemSchema, { updatedAt: "", quantity: 5 });
  });

  it("accepts a minimal update with only updatedAt", () => {
    expectPass(updateBoqItemSchema, { updatedAt: "2024-01-01T00:00:00Z" });
  });

  it("accepts lifecycleStatus from the allowed enum", () => {
    const data = expectPass(updateBoqItemSchema, {
      updatedAt: "2024-01-01T00:00:00Z",
      lifecycleStatus: "approved",
    });
    expect(data.lifecycleStatus).toBe("approved");
  });

  it("rejects invalid lifecycleStatus", () => {
    expectFail(updateBoqItemSchema, {
      updatedAt: "2024-01-01T00:00:00Z",
      lifecycleStatus: "something-else",
    });
  });

  it("accepts clientApprovalStatus from the allowed enum", () => {
    expectPass(updateBoqItemSchema, {
      updatedAt: "2024-01-01T00:00:00Z",
      clientApprovalStatus: "pending",
    });
  });

  it("rejects invalid clientApprovalStatus", () => {
    expectFail(updateBoqItemSchema, {
      updatedAt: "2024-01-01T00:00:00Z",
      clientApprovalStatus: "maybe",
    });
  });

  it("rejects non-UUID sectionId", () => {
    expectFail(updateBoqItemSchema, {
      updatedAt: "2024-01-01T00:00:00Z",
      sectionId: "not-a-uuid",
    });
  });

  it("rejects negative installedQty", () => {
    expectFail(updateBoqItemSchema, {
      updatedAt: "2024-01-01T00:00:00Z",
      installedQty: -1,
    });
  });
});

// ── deleteBoqItemSchema ──────────────────────────────────────────────────────

describe("deleteBoqItemSchema", () => {
  it("requires updatedAt", () => {
    expectFail(deleteBoqItemSchema, {});
  });

  it("accepts a non-empty updatedAt string", () => {
    expectPass(deleteBoqItemSchema, { updatedAt: "2024-01-01T00:00:00Z" });
  });
});

// ── reorderItemsSchema ───────────────────────────────────────────────────────

describe("reorderItemsSchema", () => {
  it("accepts a null sectionId", () => {
    const data = expectPass(reorderItemsSchema, {
      sectionId: null,
      orderedIds: [VALID_UUID],
    });
    expect(data.sectionId).toBeNull();
  });

  it("accepts a UUID sectionId", () => {
    const data = expectPass(reorderItemsSchema, {
      sectionId: VALID_UUID,
      orderedIds: [VALID_UUID_2],
    });
    expect(data.sectionId).toBe(VALID_UUID);
  });

  it("rejects missing sectionId (must be explicit null or UUID)", () => {
    expectFail(reorderItemsSchema, { orderedIds: [VALID_UUID] });
  });

  it("rejects empty orderedIds", () => {
    expectFail(reorderItemsSchema, { sectionId: null, orderedIds: [] });
  });

  it("rejects non-UUID ids", () => {
    expectFail(reorderItemsSchema, {
      sectionId: null,
      orderedIds: ["nope"],
    });
  });
});

// ── addElementToBoqSchema ────────────────────────────────────────────────────

describe("addElementToBoqSchema", () => {
  it("defaults quantity to 1", () => {
    const data = expectPass(addElementToBoqSchema, {
      sectionId: null,
      elementId: VALID_UUID,
    });
    expect(data.quantity).toBe(1);
  });

  it("accepts explicit quantity", () => {
    const data = expectPass(addElementToBoqSchema, {
      sectionId: VALID_UUID,
      elementId: VALID_UUID_2,
      quantity: 7,
    });
    expect(data.quantity).toBe(7);
  });

  it("rejects non-UUID elementId", () => {
    expectFail(addElementToBoqSchema, {
      sectionId: null,
      elementId: "nope",
    });
  });

  it("rejects missing elementId", () => {
    expectFail(addElementToBoqSchema, { sectionId: null });
  });

  it("rejects negative quantity", () => {
    expectFail(addElementToBoqSchema, {
      sectionId: null,
      elementId: VALID_UUID,
      quantity: -1,
    });
  });
});
