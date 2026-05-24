"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { ArrowRight, FilePlus, Layers, MessageSquareQuote } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { API } from "@/lib/api/routes";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { timeAgo } from "@/lib/formatTime";
import type { BoqItemHistoryEvent, UserRole } from "@/types";
import { phaseToLabel, phaseToVariant } from "../_lib/formatters";

interface BoqItemActivityProps {
  projectId: string;
  itemId: string;
  /** Drives whether phase labels use the shortened client-side form. */
  viewerRole: UserRole | null;
}

/**
 * Activity tab — vertical rail with avatar bullets, one entry per phase-change
 * audit event (single-item and bulk rows combined server-side). Comment-bearing
 * transitions render as cards with a quoted body; bare transitions render as a
 * single-line event row. Matches the `TaskTimeline` pattern so the two feeds
 * feel like the same surface.
 */
export function BoqItemActivity({
  projectId,
  itemId,
  viewerRole,
}: BoqItemActivityProps) {
  const { data, error, isLoading } = useSWR<{
    events: BoqItemHistoryEvent[];
  }>(API.boqItemHistory(projectId, itemId));

  const events = useMemo(() => data?.events ?? [], [data?.events]);

  if (isLoading) {
    return (
      <div className="relative pt-1 pb-2">
        <Rail />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <EventSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs italic text-error">
        Couldn&apos;t load activity. Try again in a moment.
      </p>
    );
  }

  if (events.length === 0) {
    return <p className="text-xs italic text-text-muted">No activity yet.</p>;
  }

  return (
    <div className="relative pt-1 pb-2">
      <Rail />
      <div className="flex flex-col gap-4">
        {events.map((e) =>
          e.comment ? (
            <CommentEvent key={e.id} event={e} viewerRole={viewerRole} />
          ) : (
            <BareEvent key={e.id} event={e} viewerRole={viewerRole} />
          )
        )}
      </div>
    </div>
  );
}

/** Continuous left rail that bullet avatars/icons sit on. Matches the task page rail. */
function Rail() {
  return (
    <div
      aria-hidden
      className="absolute left-[15px] top-3 bottom-3 w-px bg-border-default"
    />
  );
}

// ─── Bare event row (no comment) ──────────────────────────────────────────────

function BareEvent({
  event,
  viewerRole,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
}) {
  // First-ever event (no `from`) is the creation row — show a different
  // bullet so the timeline reads "this is where the item came into being".
  const isCreation = event.from_phase === null;
  return (
    <div className="relative pl-9 py-0.5">
      <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-bg-elevated ring-2 ring-bg-secondary flex items-center justify-center text-text-muted">
        {isCreation ? (
          <FilePlus className="w-3.5 h-3.5" />
        ) : (
          <ArrowRight className="w-3.5 h-3.5" />
        )}
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-text-secondary leading-6">
        <span className="font-medium text-text-primary">
          {event.actor_name}
        </span>
        <PhaseChangeText event={event} viewerRole={viewerRole} />
        {event.is_bulk && <BulkHint count={event.bulk_item_count ?? null} />}
        <span className="text-xs text-text-muted">·</span>
        <time
          className="text-xs text-text-muted"
          dateTime={event.created_at}
          title={new Date(event.created_at).toLocaleString()}
        >
          {timeAgo(event.created_at)}
        </time>
      </div>
    </div>
  );
}

// ─── Comment-bearing card ─────────────────────────────────────────────────────

function CommentEvent({
  event,
  viewerRole,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
}) {
  return (
    <article className="relative pl-9">
      <Avatar
        initials={deriveInitials(event.actor_name)}
        color={avatarColor(event.actor_id)}
        size="sm"
        className="absolute left-0 top-2 ring-2 ring-bg-secondary"
      />
      <div className="rounded-lg border border-border-default bg-bg-secondary overflow-hidden">
        <header className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-bg-elevated/40 border-b border-border-default">
          <span className="text-sm font-semibold text-text-primary">
            {event.actor_name}
          </span>
          <RoleTag role={event.actor_role} />
          <span className="text-xs text-text-muted">·</span>
          <PhaseChangeText event={event} viewerRole={viewerRole} />
          {event.is_bulk && <BulkHint count={event.bulk_item_count ?? null} />}
          <span className="flex-1" />
          <time
            className="text-xs text-text-muted"
            dateTime={event.created_at}
            title={new Date(event.created_at).toLocaleString()}
          >
            {timeAgo(event.created_at)}
          </time>
        </header>
        <div className="flex gap-2 px-4 py-3 text-sm text-text-primary leading-relaxed">
          <MessageSquareQuote className="w-4 h-4 mt-0.5 shrink-0 text-text-muted" />
          <p className="whitespace-pre-wrap">{event.comment}</p>
        </div>
      </div>
    </article>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render either `→ <ToPill>` (no from in metadata — pre-history-feature
 * single events, or bulk events whose item_phases map is missing) or
 * `moved phase from <FromPill> to <ToPill>`.
 */
function PhaseChangeText({
  event,
  viewerRole,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
}) {
  const toLabel = phaseToLabel(event.to_phase, viewerRole);
  const toVariant = phaseToVariant(event.to_phase);
  if (event.from_phase) {
    const fromLabel = phaseToLabel(event.from_phase, viewerRole);
    const fromVariant = phaseToVariant(event.from_phase);
    return (
      <>
        <span>moved phase from</span>
        <Badge variant={fromVariant}>{fromLabel}</Badge>
        <span>to</span>
        <Badge variant={toVariant}>{toLabel}</Badge>
      </>
    );
  }
  return (
    <>
      <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
      <Badge variant={toVariant}>{toLabel}</Badge>
    </>
  );
}

function RoleTag({ role }: { role: UserRole }) {
  // Match the existing role pill styling used elsewhere in the BOQ surface:
  // a tinted text-xs label. We reuse Badge with a sensible variant per role.
  const map: Record<
    UserRole,
    { label: string; variant: Parameters<typeof Badge>[0]["variant"] }
  > = {
    pm: { label: "PM", variant: "info" },
    architect: { label: "Architect", variant: "success" },
    client: { label: "Client", variant: "approved-client" },
    vendor: { label: "Vendor", variant: "warning" },
  };
  const cfg = map[role];
  return (
    <Badge
      variant={cfg.variant}
      className="px-2 py-0 text-[10px] font-semibold tracking-wide"
    >
      {cfg.label}
    </Badge>
  );
}

function BulkHint({ count }: { count: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border-default bg-bg-elevated/40 text-[10px] font-semibold text-text-muted">
      <Layers className="w-2.5 h-2.5" />
      bulk{count ? ` · ${count} items` : ""}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function EventSkeleton() {
  return (
    <div className="relative pl-9">
      <Skeleton className="absolute left-0 top-0 w-6 h-6 rounded-full ring-2 ring-bg-secondary" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
