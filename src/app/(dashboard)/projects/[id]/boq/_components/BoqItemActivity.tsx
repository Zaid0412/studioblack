"use client";

import useSWR from "swr";
import { ArrowRight, FilePlus, Layers, MessageSquareQuote } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
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

  if (isLoading) {
    return (
      <TimelineFrame>
        {Array.from({ length: 3 }).map((_, i) => (
          <EventSkeleton key={i} />
        ))}
      </TimelineFrame>
    );
  }

  if (error) {
    return (
      <p className="text-xs italic text-error">
        Couldn&apos;t load activity. Try again in a moment.
      </p>
    );
  }

  const events = data?.events ?? [];
  if (events.length === 0) {
    return <p className="text-xs italic text-text-muted">No activity yet.</p>;
  }

  return (
    <TimelineFrame>
      {events.map((e) =>
        e.comment ? (
          <CommentEvent key={e.id} event={e} viewerRole={viewerRole} />
        ) : (
          <BareEvent key={e.id} event={e} viewerRole={viewerRole} />
        )
      )}
    </TimelineFrame>
  );
}

/** Wrapper that draws the continuous left rail behind a stack of entries. */
function TimelineFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pt-1 pb-2">
      <div
        aria-hidden
        className="absolute left-[15px] top-3 bottom-3 w-px bg-border-default"
      />
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ─── Event variants ──────────────────────────────────────────────────────────

function BareEvent({
  event,
  viewerRole,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
}) {
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
      <EventHeader event={event} viewerRole={viewerRole} />
    </div>
  );
}

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
        <header className="px-4 py-2.5 bg-bg-elevated/40 border-b border-border-default">
          <EventHeader event={event} viewerRole={viewerRole} card />
        </header>
        <div className="flex gap-2 px-4 py-3 text-sm text-text-primary leading-relaxed">
          <MessageSquareQuote className="w-4 h-4 mt-0.5 shrink-0 text-text-muted" />
          <p className="whitespace-pre-wrap">{event.comment}</p>
        </div>
      </div>
    </article>
  );
}

/**
 * Shared row: actor + (role pill in card variant) + phase-change pills +
 * optional bulk hint + relative time. Bare rows render this directly next
 * to the rail bullet; comment cards render it inside their header strip.
 * `card` shifts the time to the right edge.
 */
function EventHeader({
  event,
  viewerRole,
  card,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
  card?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-text-secondary leading-6">
      <span className="font-medium text-text-primary">{event.actor_name}</span>
      {card && <RoleTag role={event.actor_role} />}
      <PhaseChangeText event={event} viewerRole={viewerRole} />
      {event.is_bulk && <BulkHint count={event.bulk_item_count ?? null} />}
      {card ? (
        <span className="flex-1" />
      ) : (
        <span className="text-xs text-text-muted">·</span>
      )}
      <time
        className="text-xs text-text-muted"
        dateTime={event.created_at}
        title={new Date(event.created_at).toLocaleString()}
      >
        {timeAgo(event.created_at)}
      </time>
    </div>
  );
}

// ─── Inline pieces ────────────────────────────────────────────────────────────

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

const ROLE_BADGE: Record<UserRole, { label: string; variant: BadgeVariant }> = {
  pm: { label: "PM", variant: "info" },
  architect: { label: "Architect", variant: "success" },
  client: { label: "Client", variant: "approved-client" },
  vendor: { label: "Vendor", variant: "warning" },
};

function RoleTag({ role }: { role: UserRole }) {
  const cfg = ROLE_BADGE[role];
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
