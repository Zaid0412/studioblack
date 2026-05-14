import type { BoqItemPhase } from "@/lib/validations";

/**
 * SINGLE SOURCE OF TRUTH for BOQ item phase-transition permissions.
 *
 * Both the server (`src/app/api/projects/[id]/boq/_helpers.ts`) and the
 * client UI (`src/app/(dashboard)/projects/[id]/boq/_lib/formatters.ts`)
 * call this. Do not duplicate the matrix elsewhere — server rejection
 * and UI button-hiding must agree, otherwise users see buttons that
 * always 403 (or worse, the UI hides a button the server actually
 * accepts, blocking a legitimate action).
 *
 * Per the 2026-05-12 spec:
 * - `internal_review`     — creator or PM
 * - `internally_approved` — PM, and NOT the creator (4-eyes)
 * - `submitted_to_client` — PM
 * - `client_approved`     — client
 * - `change_requested`    — PM or client
 * - `draft`               — creator or PM (escape hatch / re-do)
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
