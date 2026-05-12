"use client";

import { AlertTriangle, Clock, FilePen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoqStatus } from "@/lib/validations";
import { timeAgo } from "@/lib/formatTime";
import { boqStatusToLabel, boqStatusToVariant } from "../_lib/formatters";

/**
 * Statuses the generic PATCH /api/projects/[id]/boq endpoint accepts.
 * The internal-review statuses go through dedicated endpoints, so they
 * are intentionally NOT in this set.
 */
type DownstreamBoqStatus =
  | "draft"
  | "submitted_to_client"
  | "client_approved"
  | "locked"
  | "superseded";

interface BoqHeaderProps {
  title: string;
  version: number;
  status: BoqStatus;
  currency: string;
  itemCount: number;
  pendingApprovals: number;
  marginBleedCount: number;
  canEdit: boolean;
  /** True when the current viewer is the BOQ creator. Drives which action buttons render. */
  isCreator: boolean;
  /**
   * True when the current viewer is allowed to approve / request changes.
   * Architects and PMs other than the creator. Clients are always false.
   */
  canReview: boolean;
  /** ISO timestamp of the most recent internal approval, if any. */
  internallyApprovedAt: string | null;
  /** Name of the user who last internally approved the BOQ, if any. */
  internallyApprovedByName: string | null;
  /** ISO timestamp of the BOQ's last edit. Drives the "edited since approval" badge. */
  updatedAt: string;
  // Internal-review action handlers — wired by the parent.
  onSubmitForReview?: () => void;
  onCancelReview?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  // Existing client-flow transitions (Send to client / Lock).
  onTransition?: (next: DownstreamBoqStatus) => void;
  /** True while any action is in-flight; disables the buttons. */
  transitioning?: boolean;
}

const STATUSES_WITH_APPROVAL_HISTORY = new Set<BoqStatus>([
  "internally_approved",
  "submitted_to_client",
  "client_approved",
  "locked",
]);

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
  isCreator,
  canReview,
  internallyApprovedAt,
  internallyApprovedByName,
  updatedAt,
  onSubmitForReview,
  onCancelReview,
  onApprove,
  onRequestChanges,
  onTransition,
  transitioning,
}: BoqHeaderProps) {
  // The badge surfaces whenever the BOQ has been touched after an
  // approval — useful to PMs/architects (re-review prompt) AND clients
  // (transparency about edits since the BOQ they were sent).
  const showStaleEditBadge =
    internallyApprovedAt !== null &&
    STATUSES_WITH_APPROVAL_HISTORY.has(status) &&
    new Date(updatedAt).getTime() > new Date(internallyApprovedAt).getTime();

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
          {showStaleEditBadge && (
            <Badge variant="warning" className="gap-1 !px-2">
              <FilePen className="h-3 w-3" />
              Edited since approval
            </Badge>
          )}
          <span>v{version}</span>
          <span>·</span>
          <span>{currency}</span>
          <span>·</span>
          <span>
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </div>
        {internallyApprovedAt && (
          <p className="text-xs text-text-muted">
            Approved
            {internallyApprovedByName && ` by ${internallyApprovedByName}`}
            {" · "}
            {timeAgo(internallyApprovedAt)}
          </p>
        )}
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
        {canEdit && (
          <ActionButtons
            status={status}
            isCreator={isCreator}
            canReview={canReview}
            onSubmitForReview={onSubmitForReview}
            onCancelReview={onCancelReview}
            onApprove={onApprove}
            onRequestChanges={onRequestChanges}
            onTransition={onTransition}
            transitioning={transitioning}
          />
        )}
      </div>
    </div>
  );
}

function ActionButtons({
  status,
  isCreator,
  canReview,
  onSubmitForReview,
  onCancelReview,
  onApprove,
  onRequestChanges,
  onTransition,
  transitioning,
}: {
  status: BoqStatus;
  isCreator: boolean;
  canReview: boolean;
  onSubmitForReview?: () => void;
  onCancelReview?: () => void;
  onApprove?: () => void;
  onRequestChanges?: () => void;
  onTransition?: (next: DownstreamBoqStatus) => void;
  transitioning?: boolean;
}) {
  const busy = !!transitioning;

  // Creator-driven actions (draft / changes_requested).
  if (status === "draft") {
    if (!isCreator || !onSubmitForReview) return null;
    return (
      <Button
        type="button"
        size="sm"
        onClick={onSubmitForReview}
        disabled={busy}
      >
        {busy ? "Working..." : "Submit for internal review"}
      </Button>
    );
  }

  if (status === "changes_requested") {
    if (!isCreator || !onSubmitForReview) return null;
    return (
      <Button
        type="button"
        size="sm"
        onClick={onSubmitForReview}
        disabled={busy}
      >
        {busy ? "Working..." : "Resubmit"}
      </Button>
    );
  }

  // Pending review — creator sees Cancel; reviewer sees Approve + Request changes.
  if (status === "pending_internal_review") {
    if (isCreator && onCancelReview) {
      return (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onCancelReview}
          disabled={busy}
        >
          {busy ? "Working..." : "Cancel review"}
        </Button>
      );
    }
    if (canReview && onApprove && onRequestChanges) {
      return (
        <>
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={onRequestChanges}
            disabled={busy}
          >
            Request changes
          </Button>
          <Button type="button" size="sm" onClick={onApprove} disabled={busy}>
            {busy ? "Working..." : "Approve"}
          </Button>
        </>
      );
    }
    return null;
  }

  // Internally approved → "Send to client" unlocks the existing transition path.
  if (status === "internally_approved" && onTransition) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => onTransition("submitted_to_client")}
        disabled={busy}
      >
        {busy ? "Working..." : "Send to client"}
      </Button>
    );
  }

  // Existing downstream transitions kept intact.
  if (status === "submitted_to_client" && onTransition) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => onTransition("client_approved")}
        disabled={busy}
      >
        {busy ? "Working..." : "Mark approved"}
      </Button>
    );
  }
  if (status === "client_approved" && onTransition) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => onTransition("locked")}
        disabled={busy}
      >
        {busy ? "Working..." : "Lock BOQ"}
      </Button>
    );
  }

  return null;
}
