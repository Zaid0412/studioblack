import type {
  BoqItemLifecycleStatus,
  BoqItemClientApprovalStatus,
} from "@/lib/validations";
import type { BadgeVariant } from "@/components/ui/badge";

/** Sentinel used in selects/grouping when an item has no section. */
export const BOQ_NO_SECTION_ID = "__unassigned__";

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

const LIFECYCLE_VARIANT: Record<BoqItemLifecycleStatus, BadgeVariant> = {
  draft: "draft",
  submitted: "submitted",
  approved: "approved-arch",
  rejected: "error",
  queried: "in-review",
  locked: "info",
  change_order_pending: "warning",
  superseded: "archived",
};

const CLIENT_APPROVAL_VARIANT: Record<
  BoqItemClientApprovalStatus,
  BadgeVariant
> = {
  pending: "draft",
  approved: "approved-client",
  rejected: "changes-requested",
  queried: "in-review",
};

export function lifecycleToVariant(
  status: BoqItemLifecycleStatus
): BadgeVariant {
  return LIFECYCLE_VARIANT[status];
}

export function clientApprovalToVariant(
  status: BoqItemClientApprovalStatus
): BadgeVariant {
  return CLIENT_APPROVAL_VARIANT[status];
}

/** Parse a numeric string coming from `pg` NUMERIC columns into a finite number. */
export function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isFinite(n) ? n : 0;
}

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

export function formatQty(value: string | number): string {
  const n = toNum(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(n);
}

export function formatPct(value: string | number): string {
  const n = toNum(value);
  return `${n.toFixed(1)}%`;
}
