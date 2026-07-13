import { DEFAULT_CURRENCY } from "@/lib/constants";
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
  ready_for_procurement: {
    label: "Ready for Procurement",
    variant: "active",
  },
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
  // RFQ-4a: `ready_for_procurement` is a post-approval internal state. To the
  // client it's still just "Approved" — they never see the procurement wording.
  ready_for_procurement: "Approved",
};

/**
 * Phases the client should perceive as `client_approved`. `ready_for_procurement`
 * is internal to procurement — clients keep seeing the approved badge/label.
 */
function clientPhaseAlias(phase: BoqItemPhase): BoqItemPhase {
  return phase === "ready_for_procurement" ? "client_approved" : phase;
}

/**
 * Map a BOQ item's phase to a Badge variant. For clients, the internal
 * `ready_for_procurement` state reuses the `client_approved` variant so the
 * badge colour matches the "Approved" label they see.
 */
export function phaseToVariant(
  phase: BoqItemPhase,
  viewerRole?: UserRole | null
): BadgeVariant {
  const resolved = viewerRole === "client" ? clientPhaseAlias(phase) : phase;
  return PHASE_DISPLAY[resolved].variant;
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
  currency: string = DEFAULT_CURRENCY
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
  currency: string = DEFAULT_CURRENCY
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

/** Dimension unit stored on each BOQ item — defaults to `'m'` historically. */
export const DIMENSION_UNITS = ["m", "ft"] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export const FT_TO_M = 0.3048;
export const M_TO_FT = 1 / FT_TO_M;

const METRIC_2DP = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Parse a feet+inches string into decimal feet, or `null` when the input
 * is blank/garbage. Accepts mixed notation:
 *   "7'10\"", "7'10", "7' 10\"", "7'10.5\"", "7'", "10\"", "7", "7.5'"
 * Inches ≥ 12 wrap into feet (`7'13"` → 7.833 + 1.0833 = 8.0833 → "8'1\"").
 */
export function parseFeetInches(input: string): number | null {
  const raw = input.trim();
  if (raw === "") return null;
  // Plain decimal/integer with no marks → treat as feet.
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  // Strip and capture: optional `<feet>'` then optional `<inches>"`.
  const match = raw.match(
    /^(?:(\d+(?:\.\d+)?)\s*')?\s*(?:(\d+(?:\.\d+)?)\s*"?)?$/
  );
  if (!match) return null;
  const feetPart = match[1] !== undefined ? Number.parseFloat(match[1]) : 0;
  const inchPart = match[2] !== undefined ? Number.parseFloat(match[2]) : 0;
  if (!Number.isFinite(feetPart) || !Number.isFinite(inchPart)) return null;
  if (feetPart < 0 || inchPart < 0) return null;
  if (match[1] === undefined && match[2] === undefined) return null;
  return feetPart + inchPart / 12;
}

/**
 * Render decimal feet as the `7'10"` notation. Inches are rounded to 2dp
 * with trailing zeros dropped, so:
 *   7.8333... → "7'10\""    (whole)
 *   7.85     → "7'10.2\""   (one decimal)
 *   7.854... → "7'10.25\""  (two decimals)
 * 12+ inches wrap to the next foot (`7'12"` is never displayed).
 */
export function formatFeetInches(decimalFeet: number): string {
  if (!Number.isFinite(decimalFeet) || decimalFeet < 0) return "";
  let feet = Math.floor(decimalFeet);
  let inches = (decimalFeet - feet) * 12;
  // Round inches to 2dp first so a value like 11.9999 doesn't lock at 11.
  inches = Math.round(inches * 100) / 100;
  if (inches >= 12) {
    feet += Math.floor(inches / 12);
    inches = inches % 12;
  }
  const trimmed = trimTrailingZeros(inches);
  return `${feet}'${trimmed}"`;
}

function trimTrailingZeros(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(n).replace(/0+$/, "").replace(/\.$/, "");
}

/** Single-value dimension display picked by unit (2dp for m). */
export function formatDimension(
  value: string | number | null,
  unit: DimensionUnit
): string {
  if (value === null || value === "") return "—";
  const n = toNum(value);
  if (n <= 0) return "—";
  if (unit === "ft") return formatFeetInches(n);
  return METRIC_2DP.format(n);
}

/**
 * Render an L × B × H dimensions string for a BOQ item, skipping any
 * blank dimension. Returns `null` when no dimension is set so callers
 * can omit the subscript entirely.
 *
 * Metric → `2.50 × 1.50 × 0.50 m`. Imperial → `7'10" × 4'11" × 1'8"`.
 */
export function formatDimensions(
  length: string | null,
  breadth: string | null,
  height: string | null,
  unit: DimensionUnit = "m"
): string | null {
  const parts = [length, breadth, height]
    .map((s) => (s == null ? null : Number.parseFloat(s)))
    .filter((n): n is number => n != null && Number.isFinite(n) && n > 0);
  if (parts.length === 0) return null;
  if (unit === "ft") {
    return parts.map((n) => formatFeetInches(n)).join(" × ");
  }
  return `${parts.map((n) => METRIC_2DP.format(n)).join(" × ")} m`;
}

/** Unit-aware dimension parser. Blank → null; garbage → null. */
export function parseDimensionValue(
  input: string,
  unit: DimensionUnit
): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (unit === "ft") return parseFeetInches(trimmed);
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface ConvertedDimensions {
  length: number | null;
  breadth: number | null;
  height: number | null;
  /** Product of the three positive converted dims. `null` when all are blank. */
  quantity: number | null;
}

/**
 * Convert three stored dimensions between m and ft, preserving the physical
 * measurement (× 0.3048 or × 1/0.3048). Also returns the L×B×H product so
 * callers can keep `quantity` in sync. Blank inputs stay blank. Returns the
 * same numeric values when `from === to` (callers should normally guard).
 */
export function convertDimensions(
  length: string | null,
  breadth: string | null,
  height: string | null,
  from: DimensionUnit,
  to: DimensionUnit
): ConvertedDimensions {
  const factor = from === to ? 1 : to === "ft" ? M_TO_FT : FT_TO_M;
  const convert = (raw: string | null): number | null => {
    const n = parseDimensionValue(raw ?? "", from);
    if (n === null) return null;
    return Number((n * factor).toFixed(4));
  };
  const lengthN = convert(length);
  const breadthN = convert(breadth);
  const heightN = convert(height);
  const positives = [lengthN, breadthN, heightN].filter(
    (n): n is number => n != null && Number.isFinite(n) && n > 0
  );
  const quantity =
    positives.length > 0
      ? Number(positives.reduce((a, b) => a * b, 1).toFixed(6))
      : null;
  return { length: lengthN, breadth: breadthN, height: heightN, quantity };
}

const QTY_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

/** Format a quantity with up to 3 decimal places and locale-aware thousands separators. */
export function formatQty(value: string | number): string {
  return QTY_FORMAT.format(toNum(value));
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
