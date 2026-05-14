import type { BoqItemPhase } from "@/lib/validations";

/**
 * Single source of truth for BOQ item phase-transition permissions. Both
 * the server route guard and the client UI button-gating call this — keep
 * the matrix here only, or they'll drift.
 */
export function canFireBoqPhaseTransition(opts: {
  target: BoqItemPhase;
  isPM: boolean;
  isClient: boolean;
  isCreator: boolean;
}): boolean {
  const { target, isPM, isClient, isCreator } = opts;
  switch (target) {
    case "internal_review":
      return isCreator || isPM;
    case "internally_approved":
      return isPM && !isCreator;
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
