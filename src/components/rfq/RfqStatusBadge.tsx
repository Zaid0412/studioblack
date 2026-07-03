import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { RfqStatus } from "@/types";

const VARIANT: Record<RfqStatus, BadgeVariant> = {
  draft: "draft",
  issued: "submitted",
  quotes_received: "in-review",
  under_review: "in-review",
  awarded: "approved-arch",
  cancelled: "archived",
  superseded: "archived",
};

/** Coloured pill matching the RFQ lifecycle states. */
export function RfqStatusBadge({ status }: { status: RfqStatus }) {
  const t = useTranslations("rfq.status");
  return <Badge variant={VARIANT[status]}>{t(status)}</Badge>;
}
