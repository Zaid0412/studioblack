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
        "internal_changes_requested",
        "draft",
      ])
    );
  });

  it("internally_approved → sent_to_client unlocks Send to client", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.internally_approved).toContain(
      "sent_to_client"
    );
  });

  it("sent_to_client → client_reviewing (auto-bump target)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.sent_to_client).toContain(
      "client_reviewing"
    );
  });

  it("client_reviewing → client_approved (client decision)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_reviewing).toContain(
      "client_approved"
    );
  });

  it("client_reviewing → client_changes_requested (client kick-back)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_reviewing).toContain(
      "client_changes_requested"
    );
  });

  it("client_approved can be re-opened via client_changes_requested", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_approved).toContain(
      "client_changes_requested"
    );
  });

  it("internal_changes_requested → draft (creator reworks)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.internal_changes_requested).toContain(
      "draft"
    );
  });

  it("client_changes_requested → draft (creator reworks)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_changes_requested).toContain(
      "draft"
    );
  });

  it("PM pull-back: every client-visible phase can fire internal_changes_requested", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.sent_to_client).toContain(
      "internal_changes_requested"
    );
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_reviewing).toContain(
      "internal_changes_requested"
    );
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_changes_requested).toContain(
      "internal_changes_requested"
    );
    expect(BOQ_ITEM_PHASE_TRANSITIONS.client_approved).toContain(
      "internal_changes_requested"
    );
  });

  it("does NOT allow draft → internally_approved (self-approval bypass)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.draft).not.toContain(
      "internally_approved"
    );
  });

  it("does NOT allow draft → sent_to_client (gate skip)", () => {
    expect(BOQ_ITEM_PHASE_TRANSITIONS.draft).not.toContain("sent_to_client");
  });

  it("every key in the map is a valid BoqItemPhase", () => {
    const keys = Object.keys(BOQ_ITEM_PHASE_TRANSITIONS) as BoqItemPhase[];
    expect(keys).toEqual(
      expect.arrayContaining([
        "draft",
        "internal_review",
        "internal_changes_requested",
        "internally_approved",
        "sent_to_client",
        "client_reviewing",
        "client_changes_requested",
        "client_approved",
      ])
    );
  });
});
