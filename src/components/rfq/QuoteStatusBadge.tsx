import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { VendorQuoteStatus } from "@/types";

const VARIANT: Record<VendorQuoteStatus, BadgeVariant> = {
  submitted: "submitted",
  under_review: "in-review",
  awarded: "approved-arch",
  rejected: "archived",
  expired: "archived",
};

const LABEL: Record<VendorQuoteStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  awarded: "Awarded",
  rejected: "Rejected",
  expired: "Expired",
};

/** Coloured pill matching the vendor quote lifecycle states. */
export function QuoteStatusBadge({ status }: { status: VendorQuoteStatus }) {
  return <Badge variant={VARIANT[status]}>{LABEL[status]}</Badge>;
}
