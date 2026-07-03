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
    case "internal_changes_requested":
      // PM owns the kick-back end-to-end: both internal QA rejections AND
      // the "pull-back" path from any client-visible phase. Client uses
      // `client_changes_requested` instead.
      return isPM;
    case "internally_approved":
      return (isPM || isArchitect) && !isCreator;
    case "sent_to_client":
      return isPM || isArchitect;
    case "client_reviewing":
      // Auto-set on the client's first read of the BOQ (see
      // bumpSentToClientToReviewing in queries/boq.ts). Never fireable
      // through the manual transition matrix.
      return false;
    case "client_changes_requested":
      return isClient;
    case "client_approved":
      return isClient;
    case "ready_for_procurement":
      // RFQ-4a: only the PM approves an item for procurement (the RFQ gate).
      return isPM;
    case "draft":
      return isCreator || isPM;
  }
}
