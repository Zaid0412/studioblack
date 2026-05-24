/**
 * Pin the BOQ phase-permission matrix at `src/lib/boq/phasePermissions.ts`.
 *
 * Both the server route guard and the client UI button-gating call this —
 * if the matrix drifts, users either see buttons that 403 or are locked
 * out of legitimate actions. The 4-eyes rule on `internally_approved`
 * (any non-creator staffer, PM or architect) is the most failure-prone
 * row; cover it explicitly.
 */
import { describe, it, expect } from "vitest";
import { canFireBoqPhaseTransition } from "@/lib/boq/phasePermissions";
import type { BoqItemPhase } from "@/lib/validations";

function actor(overrides: {
  isPM?: boolean;
  isArchitect?: boolean;
  isClient?: boolean;
  isCreator?: boolean;
}) {
  return {
    isPM: overrides.isPM ?? false,
    isArchitect: overrides.isArchitect ?? false,
    isClient: overrides.isClient ?? false,
    isCreator: overrides.isCreator ?? false,
  };
}

const fire = (target: BoqItemPhase, who: ReturnType<typeof actor>) =>
  canFireBoqPhaseTransition({ target, ...who });

describe("canFireBoqPhaseTransition — internal_review", () => {
  it("creator can submit", () => {
    expect(fire("internal_review", actor({ isCreator: true }))).toBe(true);
  });
  it("PM can submit", () => {
    expect(fire("internal_review", actor({ isPM: true }))).toBe(true);
  });
  it("architect (non-creator) cannot submit", () => {
    expect(fire("internal_review", actor({ isArchitect: true }))).toBe(false);
  });
  it("client cannot submit", () => {
    expect(fire("internal_review", actor({ isClient: true }))).toBe(false);
  });
});

describe("canFireBoqPhaseTransition — internally_approved (4-eyes)", () => {
  it("PM non-creator can approve", () => {
    expect(fire("internally_approved", actor({ isPM: true }))).toBe(true);
  });
  it("architect non-creator can approve (single-PM studio escape hatch)", () => {
    expect(fire("internally_approved", actor({ isArchitect: true }))).toBe(
      true
    );
  });
  it("PM-creator blocked (4-eyes)", () => {
    expect(
      fire("internally_approved", actor({ isPM: true, isCreator: true }))
    ).toBe(false);
  });
  it("architect-creator blocked (4-eyes)", () => {
    expect(
      fire("internally_approved", actor({ isArchitect: true, isCreator: true }))
    ).toBe(false);
  });
  it("client cannot approve internally", () => {
    expect(fire("internally_approved", actor({ isClient: true }))).toBe(false);
  });
});

describe("canFireBoqPhaseTransition — sent_to_client", () => {
  it("PM can send to client", () => {
    expect(fire("sent_to_client", actor({ isPM: true }))).toBe(true);
  });
  it("architect can send to client", () => {
    expect(fire("sent_to_client", actor({ isArchitect: true }))).toBe(true);
  });
  it("client cannot send to client", () => {
    expect(fire("sent_to_client", actor({ isClient: true }))).toBe(false);
  });
});

describe("canFireBoqPhaseTransition — client_reviewing", () => {
  it("nobody can fire it manually — auto-set on first client open", () => {
    expect(fire("client_reviewing", actor({ isPM: true }))).toBe(false);
    expect(fire("client_reviewing", actor({ isArchitect: true }))).toBe(false);
    expect(fire("client_reviewing", actor({ isClient: true }))).toBe(false);
  });
});

describe("canFireBoqPhaseTransition — client_approved", () => {
  it("only client can mark client approved", () => {
    expect(fire("client_approved", actor({ isClient: true }))).toBe(true);
    expect(fire("client_approved", actor({ isPM: true }))).toBe(false);
    expect(fire("client_approved", actor({ isArchitect: true }))).toBe(false);
  });
});

describe("canFireBoqPhaseTransition — client_changes_requested", () => {
  it("only client can fire it", () => {
    expect(fire("client_changes_requested", actor({ isClient: true }))).toBe(
      true
    );
    expect(fire("client_changes_requested", actor({ isPM: true }))).toBe(false);
    expect(fire("client_changes_requested", actor({ isArchitect: true }))).toBe(
      false
    );
  });
});

describe("canFireBoqPhaseTransition — internal_changes_requested", () => {
  it("only PM can fire it (covers both internal kick-back and pull-back)", () => {
    expect(fire("internal_changes_requested", actor({ isPM: true }))).toBe(
      true
    );
    expect(
      fire("internal_changes_requested", actor({ isArchitect: true }))
    ).toBe(false);
    expect(fire("internal_changes_requested", actor({ isClient: true }))).toBe(
      false
    );
  });
});

describe("canFireBoqPhaseTransition — draft", () => {
  it("creator can drop back to draft", () => {
    expect(fire("draft", actor({ isCreator: true }))).toBe(true);
  });
  it("PM can drop back to draft", () => {
    expect(fire("draft", actor({ isPM: true }))).toBe(true);
  });
  it("architect alone cannot drop to draft", () => {
    expect(fire("draft", actor({ isArchitect: true }))).toBe(false);
  });
  it("client cannot drop to draft", () => {
    expect(fire("draft", actor({ isClient: true }))).toBe(false);
  });
});
