import { describe, it, expect } from "vitest";
import {
  BOQ_ITEM_PHASE_TRANSITIONS,
  type BoqItemPhase,
} from "@/lib/validations";

/**
 * Pin the per-item lifecycle state machine — both the allowed transitions
 * and (by inference) the forbidden ones. Updating this test is the
 * load-bearing checkpoint when adding new phases or edges.
 */
describe("BOQ_ITEM_PHASE_TRANSITIONS", () => {
  it("draft → internal_review (only entry point to review)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.draft).toEqual(["internal_review"]);
  });

  it("internal_review forks: approve, request changes, or drop to draft", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.internal_review).toEqual(
      expect.arrayContaining([
        "internally_approved",
        "change_requested",
        "draft",
      ])
    );
  });

  it("internally_approved → submitted_to_client unlocks Send to client", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.internally_approved).toContain(
      "submitted_to_client"
    );
  });

  it("submitted_to_client → client_approved (client decision)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.submitted_to_client).toContain(
      "client_approved"
    );
  });

  it("client_approved only exits via change_requested (no terminal)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_approved).toEqual([
      "change_requested",
    ]);
  });

  it("change_requested → draft (creator reworks)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.change_requested).toEqual(["draft"]);
  });

  it("does NOT allow draft → internally_approved (self-approval bypass)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.draft).not.toContain(
      "internally_approved"
    );
  });

  it("does NOT allow draft → submitted_to_client (gate skip)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.draft).not.toContain(
      "submitted_to_client"
    );
  });

  it("every key in the map is a valid BoqItemPhase", () => {
    const keys = Object.keys(BOQ_ITEM_PHASE_TRANSITIONS) as BoqItemPhase[];
    expect(keys).toContain("draft");
    expect(keys).toContain("internal_review");
    expect(keys).toContain("internally_approved");
    expect(keys).toContain("submitted_to_client");
    expect(keys).toContain("client_approved");
    expect(keys).toContain("change_requested");
  });
});
