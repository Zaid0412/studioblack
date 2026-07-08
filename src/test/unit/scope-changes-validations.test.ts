import { describe, it, expect } from "vitest";
import {
  createScopeChangeSchema,
  updateScopeChangeSchema,
  transitionScopeChangeSchema,
  listScopeChangesQuerySchema,
  SCOPE_CHANGE_ACTIONS,
  SCOPE_CHANGE_STATUSES,
  SCOPE_CHANGE_REASONS,
  SCOPE_CHANGE_IMPACTS,
  SCOPE_CHANGE_TRANSITIONS,
  DEFAULT_IMPACT_FOR_REASON,
  parseBody,
} from "@/lib/validations";

const BOQ_ITEM_ID = "11111111-1111-4111-8111-111111111111";

describe("createScopeChangeSchema", () => {
  const valid = { boqItemId: BOQ_ITEM_ID, changeReason: "quantity" };

  it("accepts a minimal valid input", () => {
    expect(parseBody(createScopeChangeSchema, valid).success).toBe(true);
  });

  it("accepts an explicit impact + description", () => {
    expect(
      parseBody(createScopeChangeSchema, {
        ...valid,
        impact: "requote",
        description: "Client wants a thicker worktop",
      }).success
    ).toBe(true);
  });

  it("rejects a missing boqItemId", () => {
    expect(
      parseBody(createScopeChangeSchema, { changeReason: "quantity" }).success
    ).toBe(false);
  });

  it("rejects an unknown change reason", () => {
    expect(
      parseBody(createScopeChangeSchema, { ...valid, changeReason: "other" })
        .success
    ).toBe(false);
  });

  it("rejects an unknown impact", () => {
    expect(
      parseBody(createScopeChangeSchema, { ...valid, impact: "teleport" })
        .success
    ).toBe(false);
  });
});

describe("updateScopeChangeSchema", () => {
  it("accepts an empty patch", () => {
    expect(parseBody(updateScopeChangeSchema, {}).success).toBe(true);
  });

  it("accepts a partial patch", () => {
    expect(
      parseBody(updateScopeChangeSchema, { impact: "cancel_item" }).success
    ).toBe(true);
  });
});

describe("transitionScopeChangeSchema", () => {
  it("accepts a known action", () => {
    expect(
      parseBody(transitionScopeChangeSchema, { action: "submit" }).success
    ).toBe(true);
  });

  it("accepts an optional note", () => {
    expect(
      parseBody(transitionScopeChangeSchema, {
        action: "reject_review",
        note: "Out of budget",
      }).success
    ).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(
      parseBody(transitionScopeChangeSchema, { action: "yeet" }).success
    ).toBe(false);
  });

  it("rejects a missing action", () => {
    expect(parseBody(transitionScopeChangeSchema, {}).success).toBe(false);
  });
});

describe("listScopeChangesQuerySchema", () => {
  it("defaults page + limit", () => {
    const r = parseBody(listScopeChangesQuerySchema, {});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(25);
    }
  });

  it("rejects an unknown status", () => {
    expect(
      parseBody(listScopeChangesQuerySchema, { status: "bogus" }).success
    ).toBe(false);
  });
});

describe("SCOPE_CHANGE_TRANSITIONS (state machine)", () => {
  it("uses only valid statuses, roles, and never self-loops", () => {
    for (const action of SCOPE_CHANGE_ACTIONS) {
      const t = SCOPE_CHANGE_TRANSITIONS[action];
      expect(SCOPE_CHANGE_STATUSES).toContain(t.to);
      expect(t.roles.length).toBeGreaterThan(0);
      for (const from of t.from) {
        expect(SCOPE_CHANGE_STATUSES).toContain(from);
        expect(from).not.toBe(t.to);
      }
    }
  });

  it("gates approve + reject_client to the client only", () => {
    expect(SCOPE_CHANGE_TRANSITIONS.approve.roles).toEqual(["client"]);
    expect(SCOPE_CHANGE_TRANSITIONS.reject_client.roles).toEqual(["client"]);
  });

  it("keeps submit + send_to_client + reject_review studio-only", () => {
    for (const action of [
      "submit",
      "send_to_client",
      "reject_review",
    ] as const) {
      expect(SCOPE_CHANGE_TRANSITIONS[action].roles).not.toContain("client");
    }
  });
});

describe("DEFAULT_IMPACT_FOR_REASON", () => {
  it("maps every reason to a valid impact", () => {
    for (const reason of SCOPE_CHANGE_REASONS) {
      expect(SCOPE_CHANGE_IMPACTS).toContain(DEFAULT_IMPACT_FOR_REASON[reason]);
    }
  });
});
