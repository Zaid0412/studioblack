import type { BoqItemPhase } from "@/lib/validations";

/**
 * Single source of truth for BOQ item phase-transition permissions. Both
 * the server route guard and the client UI button-gating call this — keep
 * the matrix here only, or they'll drift.
 */
export function canFireBoqPhaseTransition(opts: {
  target: BoqItemPhase;
  isPM: boolean;
  isArchitect: boolean;
  isClient: boolean;
  isCreator: boolean;
}): boolean {
  const { target, isPM, isArchitect, isClient, isCreator } = opts;
  // 4-eyes rule on `internally_approved`: any studio staffer (PM or
  // architect) can approve, but never the BOQ's own creator. Architects
  // are included so single-PM studios where the PM created the BOQ are
  // not stuck — otherwise nobody but a second PM could ever approve.
  switch (target) {
    case "internal_review":
      return isCreator || isPM;
    case "internally_approved":
      return (isPM || isArchitect) && !isCreator;
    case "submitted_to_client":
      return isPM;
    case "client_approved":
      return isClient;
    case "change_requested":
      return isPM || isClient;
    case "draft":
      return isCreator || isPM;
  }
}
