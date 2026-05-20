import { describe, it, expect } from "vitest";
import {
  buildPhaseGroups,
  buildPlanByTarget,
} from "@/app/(dashboard)/projects/[id]/boq/_lib/bulkLifecyclePlanner";
import type { BoqItemPhase } from "@/lib/validations";

/** Minimal item shape the planner actually reads. */
const item = (id: string, phase: BoqItemPhase) => ({ id, phase });

describe("buildPhaseGroups", () => {
  it("groups selected items by current phase", () => {
    const groups = buildPhaseGroups(
      [
        item("a", "draft"),
        item("b", "draft"),
        item("c", "internally_approved"),
        item("d", "client_approved"),
      ],
      "submitted_to_client",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    const byPhase = Object.fromEntries(groups.map((g) => [g.phase, g.itemIds]));
    expect(byPhase.draft).toEqual(["a", "b"]);
    expect(byPhase.internally_approved).toEqual(["c"]);
    expect(byPhase.client_approved).toEqual(["d"]);
  });

  it("marks the group whose phase reaches the target as primary", () => {
    const groups = buildPhaseGroups(
      [item("a", "draft"), item("b", "internally_approved")],
      "submitted_to_client",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    const primary = groups.filter((g) => g.primary).map((g) => g.phase);
    expect(primary).toEqual(["internally_approved"]);
  });

  it("returns no primaries when no group can reach the target", () => {
    // PM picks Submitted to Client; selection contains only Draft + Client
    // Approved + Change Requested — none of those phases legally reach it.
    const groups = buildPhaseGroups(
      [
        item("a", "draft"),
        item("b", "client_approved"),
        item("c", "change_requested"),
      ],
      "submitted_to_client",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    expect(groups.every((g) => !g.primary)).toBe(true);
  });

  it("filters legal targets through role permissions (4-eyes on internally_approved)", () => {
    // PM-creator cannot fire internally_approved on items they themselves
    // created — the 4-eyes rule blocks it.
    const groups = buildPhaseGroups([item("a", "internal_review")], "draft", {
      role: "pm",
      currentUserId: "u-creator",
      boqCreatorId: "u-creator",
    });
    expect(groups[0].legalTargets).not.toContain("internally_approved");
  });

  it("strips disallowed targets for architects on draft", () => {
    // From draft, the only edge is `internal_review`, which requires
    // creator OR PM. A non-creator architect gets zero legal targets.
    const groups = buildPhaseGroups([item("a", "draft")], "internal_review", {
      role: "architect",
      currentUserId: "u-arch",
      boqCreatorId: "u-other",
    });
    expect(groups[0].legalTargets).toEqual([]);
    expect(groups[0].primary).toBe(false);
  });
});

describe("buildPlanByTarget", () => {
  it("collapses primary groups onto the user-picked target", () => {
    const groups = buildPhaseGroups(
      [
        item("a", "internally_approved"),
        item("b", "internally_approved"),
        item("c", "draft"),
      ],
      "submitted_to_client",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    const plan = buildPlanByTarget(groups, "submitted_to_client", {});
    expect(plan).toEqual([
      { target: "submitted_to_client", itemIds: ["a", "b"] },
    ]);
  });

  it("includes skipped groups when a fallback is chosen", () => {
    const groups = buildPhaseGroups(
      [
        item("a", "internally_approved"),
        item("b", "draft"),
        item("c", "draft"),
      ],
      "submitted_to_client",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    const plan = buildPlanByTarget(groups, "submitted_to_client", {
      draft: "internal_review",
    });
    // Order is iteration order of the groups (draft sits AFTER internally_approved
    // in `byPhase` map insertion order — first occurrence of each phase).
    expect(plan).toContainEqual({
      target: "submitted_to_client",
      itemIds: ["a"],
    });
    expect(plan).toContainEqual({
      target: "internal_review",
      itemIds: ["b", "c"],
    });
  });

  it("returns an empty plan when nothing qualifies and no fallbacks are picked", () => {
    const groups = buildPhaseGroups(
      [item("a", "draft"), item("b", "client_approved")],
      "submitted_to_client",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    expect(buildPlanByTarget(groups, "submitted_to_client", {})).toEqual([]);
  });

  it("merges multiple groups sharing the same fallback target", () => {
    // Both Draft and Change Requested groups get pointed at `draft` as a
    // fallback (Change Requested → Draft is the only edge; Draft staying
    // in Draft makes no sense in practice but the merge logic is what we
    // care about here — a single target accumulates ids from every group
    // that resolves to it).
    const groups = buildPhaseGroups(
      [
        item("a", "change_requested"),
        item("b", "change_requested"),
        item("c", "internal_review"),
      ],
      "client_approved",
      { role: "pm", currentUserId: "u-pm", boqCreatorId: "u-arch" }
    );
    const plan = buildPlanByTarget(groups, "client_approved", {
      change_requested: "draft",
      internal_review: "draft",
    });
    const draft = plan.find((p) => p.target === "draft");
    expect(draft?.itemIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores fallback for groups that are primary", () => {
    // If the user-picked target is already reachable for a group, its
    // primary status wins — fallback entry for that phase is ignored.
    const groups = buildPhaseGroups([item("a", "internal_review")], "draft", {
      role: "pm",
      currentUserId: "u-pm",
      boqCreatorId: "u-arch",
    });
    const plan = buildPlanByTarget(groups, "draft", {
      // bogus entry — `internal_review` is the primary group, not skipped
      internal_review: "internally_approved",
    });
    expect(plan).toEqual([{ target: "draft", itemIds: ["a"] }]);
  });
});
