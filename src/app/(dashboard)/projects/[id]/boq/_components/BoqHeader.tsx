"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUserRoleContext } from "@/contexts/UserRoleContext";
import type { BoqItemPhase } from "@/lib/validations";
import { phaseToLabel, phaseToVariant } from "../_lib/formatters";

interface BoqHeaderProps {
  title: string;
  version: number;
  currency: string;
  itemCount: number;
  marginBleedCount: number;
  /**
   * Count of items per phase, used to render the at-a-glance strip in
   * the upper-right corner of the header. Computed by the parent from
   * `boq.items` so it stays in sync with optimistic mutations.
   */
  phaseCounts: Record<BoqItemPhase, number>;
}

/**
 * Order phases appear in the header strip. Mirrors the lifecycle
 * left-to-right so the visual reading matches the workflow direction.
 */
const PHASE_ORDER: BoqItemPhase[] = [
  "draft",
  "internal_review",
  "internal_changes_requested",
  "internally_approved",
  "sent_to_client",
  "client_reviewing",
  "client_changes_requested",
  "client_approved",
];

/** Sticky title row showing BOQ identity + per-phase item counts. */
export function BoqHeader({
  title,
  version,
  currency,
  itemCount,
  marginBleedCount,
  phaseCounts,
}: BoqHeaderProps) {
  const role = useUserRoleContext()?.role ?? null;
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-2 min-w-0">
        <h2 className="text-lg font-semibold text-text-primary truncate">
          {title}
        </h2>
        <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
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
        {PHASE_ORDER.filter((p) => phaseCounts[p] > 0).map((phase) => (
          <Badge
            key={phase}
            variant={phaseToVariant(phase)}
            className="gap-1 !px-2"
          >
            <span className="tabular-nums">{phaseCounts[phase]}</span>
            <span>{phaseToLabel(phase, role)}</span>
          </Badge>
        ))}
        {marginBleedCount > 0 && (
          <Badge variant="error" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {marginBleedCount} below floor
          </Badge>
        )}
      </div>
    </div>
  );
}
