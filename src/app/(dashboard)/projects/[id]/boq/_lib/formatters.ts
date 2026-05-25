import {
  BOQ_ITEM_PHASE_TRANSITIONS,
  type BoqItemPhase,
} from "@/lib/validations";
import type { BadgeVariant } from "@/components/ui/badge";
import type { UserRole } from "@/types";
import { canFireBoqPhaseTransition } from "@/lib/boq/phasePermissions";

/** Sentinel used in selects/grouping when an item has no section. */
export const BOQ_NO_SECTION_ID = "__unassigned__";

const PHASE_DISPLAY: Record<
  BoqItemPhase,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "draft" },
  internal_review: { label: "Internal Review", variant: "in-review" },
  internal_changes_requested: {
    label: "Changes Requested",
    variant: "changes-requested",
  },
  internally_approved: {
    label: "Internally Approved",
    variant: "approved-arch",
  },
  sent_to_client: { label: "Sent to Client", variant: "submitted" },
  client_reviewing: { label: "Client Reviewing", variant: "in-review" },
  client_changes_requested: {
    label: "Client Changes Requested",
    variant: "changes-requested",
  },
  client_approved: { label: "Client Approved", variant: "approved-client" },
};

/**
 * Shortened labels rendered to clients. We strip the "Client" prefix on the
 * client side because the client only sees client-side phases — the prefix
 * is internal context that's noise to them. Studio keeps the prefix so the
 * internal vs client distinction is visible at a glance.
 */
const CLIENT_PHASE_LABEL: Partial<Record<BoqItemPhase, string>> = {
  client_reviewing: "Reviewing",
  client_changes_requested: "Changes Requested",
  client_approved: "Approved",
};

/** Map a BOQ item's phase to a Badge variant. */
export function phaseToVariant(phase: BoqItemPhase): BadgeVariant {
  return PHASE_DISPLAY[phase].variant;
}

/**
 * Human-readable label for a phase. Clients see shortened forms (no
 * "Client" prefix) — see CLIENT_PHASE_LABEL for the overrides.
 */
export function phaseToLabel(
  phase: BoqItemPhase,
  viewerRole?: UserRole | null
): string {
  if (viewerRole === "client") {
    return CLIENT_PHASE_LABEL[phase] ?? PHASE_DISPLAY[phase].label;
  }
  return PHASE_DISPLAY[phase].label;
}

/**
 * Tone classes for a kick-back transition. Client-initiated kick-backs use
 * the warning (amber) palette; PM-initiated internal ones use error (red).
 * Single source of truth for both the Details-tab `BoqChangeRequestBanner`
 * and the Activity-tab `KickbackCard` so they stay visually aligned.
 *
 * Strings are written in full (not interpolated) so Tailwind's JIT keeps
 * them in the build.
 */
export type KickbackPhase =
  | "internal_changes_requested"
  | "client_changes_requested";

/** Returns the Tailwind class set keyed to the kick-back's origin tone. */
export function kickbackPalette(phase: KickbackPhase): {
  leftBorder: string;
  bgTint: string;
  iconText: string;
  timeText: string;
} {
  return phase === "client_changes_requested"
    ? {
        leftBorder: "border-l-warning",
        bgTint: "bg-warning/10",
        iconText: "text-warning",
        timeText: "text-warning",
      }
    : {
        leftBorder: "border-l-error",
        bgTint: "bg-error/10",
        iconText: "text-error",
        timeText: "text-error",
      };
}

/**
 * Phases that need a mandatory comment from the actor (server-side schema
 * requires it). Both kick-back states (internal + client) qualify. Acts
 * as a type predicate so callers get `KickbackPhase` narrowing for free.
 */
export function isDestructivePhase(
  phase: BoqItemPhase
): phase is KickbackPhase {
  return (
    phase === "internal_changes_requested" ||
    phase === "client_changes_requested"
  );
}

export interface BoqPhaseTransitionCtx {
  role: UserRole | null;
  actorId: string | null;
  boqCreatorId: string | null;
}

/** Adapts the shared phase matrix to the (role, actorId, boqCreatorId) shape. */
export function canFireBoqItemPhaseTransition(
  target: BoqItemPhase,
  ctx: BoqPhaseTransitionCtx
): boolean {
  return canFireBoqPhaseTransition({
    target,
    isPM: ctx.role === "pm",
    isArchitect: ctx.role === "architect",
    isClient: ctx.role === "client",
    isCreator:
      ctx.boqCreatorId !== null &&
      ctx.actorId !== null &&
      ctx.actorId === ctx.boqCreatorId,
  });
}

/**
 * Targets legal from `phase` for this actor — intersect of the state-machine
 * matrix with the role-permission matrix. Used by every lifecycle picker
 * surface (row menu, drawer, bulk preview).
 */
export function getLegalPhaseTransitions(
  phase: BoqItemPhase,
  ctx: BoqPhaseTransitionCtx
): BoqItemPhase[] {
  return (BOQ_ITEM_PHASE_TRANSITIONS[phase] ?? []).filter((t) =>
    canFireBoqItemPhaseTransition(t, ctx)
  );
}

export type MarginTier = "error" | "warning" | "success";

/**
 * Three-tier margin colouring per PRD:
 * - red below the project's `minimumMarginPct` (fallback 8% floor)
 * - amber between floor and 15%
 * - green at or above 15%
 */
export function marginTier(pct: number, minimumMarginPct?: number): MarginTier {
  const floor = minimumMarginPct ?? 8;
  if (Number.isNaN(pct)) return "error";
  if (pct < floor) return "error";
  if (pct < 15) return "warning";
  return "success";
}

/** Parse a numeric string coming from `pg` NUMERIC columns into a finite number. */
export function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isFinite(n) ? n : 0;
}

/** Format a value as a currency string using `Intl.NumberFormat`, falling back to `<CODE> <amount>` on unknown ISO codes. */
export function formatCurrency(
  value: string | number,
  currency: string = "USD"
): string {
  const n = toNum(value);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

/** Currency formatter for nullable rate fields — shows "—" when unset. */
export function formatOptionalCurrency(
  value: string | number | null,
  currency: string = "USD"
): string {
  return value === null ? "—" : formatCurrency(value, currency);
}

/**
 * Parse an inline-edit input back into a number-or-null. Empty string clears
 * the field (PATCH `null`); non-numeric is rejected to null. Used by the
 * client_rate / budget_rate cells in `BoqTable` and `BoqItemDrawer`.
 */
export function parseOptionalNumber(input: string): number | null {
  if (input === "") return null;
  const n = parseFloat(input);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Render an L × B × H dimensions string for a BOQ item, skipping any
 * blank dimension. Returns `null` when no dimension is set so callers
 * can omit the subscript entirely.
 *
 * Examples:
 *   (2.5, 1.5, 0.5) → "2.5 × 1.5 × 0.5 m"
 *   (5, 3, null)    → "5 × 3 m"
 *   (null, null, 4) → "4 m"
 *   (null × 3)      → null
 */
export function formatDimensions(
  length: string | null,
  breadth: string | null,
  height: string | null
): string | null {
  const parts = [length, breadth, height]
    .map((s) => (s == null ? null : Number.parseFloat(s)))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
  if (parts.length === 0) return null;
  return `${parts.map((n) => formatQty(n)).join(" × ")} m`;
}

/** Format a quantity with up to 3 decimal places and locale-aware thousands separators. */
export function formatQty(value: string | number): string {
  const n = toNum(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(n);
}

/** Format a numeric/string value as a percentage with one decimal (e.g. `12.5%`). */
export function formatPct(value: string | number): string {
  const n = toNum(value);
  return `${n.toFixed(1)}%`;
}

/** Append an "(archived)" suffix when the linked library element is archived. */
export function formatLibraryName(name: string, archived: boolean): string {
  return archived ? `${name} (archived)` : name;
}
