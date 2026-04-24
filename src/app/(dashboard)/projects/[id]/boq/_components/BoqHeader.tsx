"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoqStatus } from "@/lib/validations";
import { boqStatusToLabel, boqStatusToVariant } from "../_lib/formatters";

interface BoqHeaderProps {
  title: string;
  version: number;
  status: BoqStatus;
  currency: string;
  itemCount: number;
  pendingApprovals: number;
  marginBleedCount: number;
  canEdit: boolean;
  onTransition?: (next: BoqStatus) => void;
  transitioning?: boolean;
}

/** Primary next-step transition per current status, for the PM action button. */
const PRIMARY_NEXT: Partial<
  Record<BoqStatus, { to: BoqStatus; label: string }>
> = {
  draft: { to: "submitted_to_client", label: "Submit to client" },
  submitted_to_client: { to: "client_approved", label: "Mark approved" },
  client_approved: { to: "locked", label: "Lock BOQ" },
};

/** Sticky title row showing BOQ title, status, and at-a-glance risk counts. */
export function BoqHeader({
  title,
  version,
  status,
  currency,
  itemCount,
  pendingApprovals,
  marginBleedCount,
  canEdit,
  onTransition,
  transitioning,
}: BoqHeaderProps) {
  const nextStep = PRIMARY_NEXT[status];
  const showAction = canEdit && nextStep && onTransition;

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-2 min-w-0">
        <h2 className="text-lg font-semibold text-text-primary truncate">
          {title}
        </h2>
        <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
          <Badge variant={boqStatusToVariant(status)} className="!px-2">
            {boqStatusToLabel(status)}
          </Badge>
          <span>v{version}</span>
          <span>·</span>
          <span>{currency}</span>
          <span>·</span>
          <span>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {pendingApprovals > 0 && (
          <Badge variant="in-review" className="gap-1">
            <Clock className="h-3 w-3" />
            {pendingApprovals} pending
          </Badge>
        )}
        {marginBleedCount > 0 && (
          <Badge variant="error" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {marginBleedCount} below floor
          </Badge>
        )}
        {showAction && nextStep && (
          <Button
            type="button"
            size="sm"
            onClick={() => onTransition!(nextStep.to)}
            disabled={transitioning}
          >
            {transitioning ? "Working..." : nextStep.label}
          </Button>
        )}
      </div>
    </div>
  );
}
