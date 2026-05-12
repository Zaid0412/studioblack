import { describe, it, expect } from "vitest";
import { BOQ_STATUS_TRANSITIONS, type BoqStatus } from "@/lib/validations";

/**
 * Pin the BOQ state machine — both the allowed transitions and (by
 * inference) the forbidden ones. Updating this test is the
 * load-bearing checkpoint when adding new statuses or edges.
 */
describe("BOQ_STATUS_TRANSITIONS", () => {
  it("draft → pending_internal_review (gate entry)", () => {
    expect(BOQ_STATUS_TRANSITIONS.draft).toEqual(["pending_internal_review"]);
  });

  it("pending_internal_review forks: approve, request changes, or cancel", () => {
    expect(BOQ_STATUS_TRANSITIONS.pending_internal_review).toEqual(
      expect.arrayContaining([
        "internally_approved",
        "changes_requested",
        "draft",
      ])
    );
  });

  it("internally_approved → submitted_to_client unlocks Send to client", () => {
    expect(BOQ_STATUS_TRANSITIONS.internally_approved).toContain(
      "submitted_to_client"
    );
  });

  it("changes_requested can resubmit OR drop to draft", () => {
    expect(BOQ_STATUS_TRANSITIONS.changes_requested).toEqual(
      expect.arrayContaining(["pending_internal_review", "draft"])
    );
  });

  it("client-flow stays unchanged: submitted_to_client → client_approved → locked", () => {
    expect(BOQ_STATUS_TRANSITIONS.submitted_to_client).toContain(
      "client_approved"
    );
    expect(BOQ_STATUS_TRANSITIONS.client_approved).toContain("locked");
  });

  it("locked + superseded are terminal", () => {
    expect(BOQ_STATUS_TRANSITIONS.locked).toEqual([]);
    expect(BOQ_STATUS_TRANSITIONS.superseded).toEqual([]);
  });

  it("does NOT allow draft → submitted_to_client (gate skip)", () => {
    expect(BOQ_STATUS_TRANSITIONS.draft).not.toContain("submitted_to_client");
  });

  it("does NOT allow draft → internally_approved (self-approval bypass)", () => {
    expect(BOQ_STATUS_TRANSITIONS.draft).not.toContain("internally_approved");
  });

  it("every key in the map is a valid BoqStatus", () => {
    const keys = Object.keys(BOQ_STATUS_TRANSITIONS) as BoqStatus[];
    expect(keys).toContain("draft");
    expect(keys).toContain("pending_internal_review");
    expect(keys).toContain("internally_approved");
    expect(keys).toContain("changes_requested");
    expect(keys).toContain("submitted_to_client");
    expect(keys).toContain("client_approved");
    expect(keys).toContain("locked");
    expect(keys).toContain("superseded");
  });
});
