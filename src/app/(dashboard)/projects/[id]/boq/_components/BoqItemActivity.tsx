"use client";

import useSWR from "swr";
import { ArrowRight, Layers, MessageSquareWarning } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/Skeleton";
import { API } from "@/lib/api/routes";
import { avatarColor } from "@/lib/avatarUtils";
import { cn, deriveInitials } from "@/lib/utils";
import { timeAgo } from "@/lib/formatTime";
import type { BoqBulkItemRef, BoqItemHistoryEvent, UserRole } from "@/types";
import {
  isDestructivePhase,
  kickbackPalette,
  phaseToLabel,
  phaseToVariant,
} from "../_lib/formatters";

/**
 * Click handler set passed through the timeline so the bulk-batch popover
 * can ask the parent to swap the open drawer to another item in the same
 * batch. Bundled into one object instead of two loose props because every
 * layer of the timeline forwards both together.
 */
interface BulkBatchNav {
  currentItemId: string;
  onOpenOtherItem?: (itemId: string) => void;
}

interface BoqItemActivityProps {
  projectId: string;
  itemId: string;
  /** Drives whether phase labels use the shortened client-side form. */
  viewerRole: UserRole | null;
  /**
   * When a user clicks an item inside the bulk-batch popover, the parent
   * is responsible for swapping the open drawer to that item. Called with
   * the clicked item's id; no-op if the parent can't resolve it.
   */
  onOpenOtherItem?: (itemId: string) => void;
}

/**
 * Per-item phase-change timeline. Renders a continuous left rail with one
 * entry per audit event; transitions into a `*_changes_requested` phase
 * promote to a `KickbackCard` so the reason for the kick-back gets its
 * own surface.
 */
export function BoqItemActivity({
  projectId,
  itemId,
  viewerRole,
  onOpenOtherItem,
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

  const nav: BulkBatchNav = { currentItemId: itemId, onOpenOtherItem };

  return (
    <TimelineFrame>
      {events.map((e) => (
        <EventEntry key={e.id} event={e} viewerRole={viewerRole} nav={nav} />
      ))}
    </TimelineFrame>
  );
}

function TimelineFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pt-2 pb-3">
      <div
        aria-hidden
        className="absolute left-[15px] top-3 bottom-3 w-px bg-border-default"
      />
      <div className="flex flex-col gap-9">{children}</div>
    </div>
  );
}

function EventEntry({
  event,
  viewerRole,
  nav,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
  nav: BulkBatchNav;
}) {
  const renderAsCard = isDestructivePhase(event.to_phase) && !!event.comment;
  return (
    <article className="relative pl-9">
      <Avatar
        initials={deriveInitials(event.actor_name)}
        color={avatarColor(event.actor_id)}
        size="sm"
        className={cn(
          "absolute left-0 ring-2 ring-bg-secondary",
          renderAsCard ? "top-1.5" : "top-0"
        )}
      />
      {renderAsCard ? (
        <KickbackCard event={event} viewerRole={viewerRole} nav={nav} />
      ) : (
        <div className="flex flex-col gap-2">
          <EventRow event={event} viewerRole={viewerRole} nav={nav} />
          {event.comment && (
            <blockquote className="border-l-2 border-border-light pl-3 py-0.5 text-sm text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
              {event.comment}
            </blockquote>
          )}
        </div>
      )}
    </article>
  );
}

function EventRow({
  event,
  viewerRole,
  nav,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
  nav: BulkBatchNav;
}) {
  return (
    <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-text-secondary leading-6">
      <span className="font-medium text-text-primary">{event.actor_name}</span>
      <PhaseChangeText
        event={event}
        viewerRole={viewerRole}
        dropMovedVerb={false}
      />
      {event.is_bulk && (
        <BulkHint
          count={event.bulk_item_count}
          items={event.bulk_items}
          nav={nav}
        />
      )}
      <time
        className="ml-auto shrink-0 text-xs text-text-muted"
        dateTime={event.created_at}
        title={new Date(event.created_at).toLocaleString()}
      >
        {timeAgo(event.created_at)}
      </time>
    </div>
  );
}

/**
 * Bordered two-tone card for kick-back events. The 3px left border colour
 * matches `BoqChangeRequestBanner` on the Details tab — warning (amber)
 * for client-initiated, error (red) for internal/PM-initiated.
 */
function KickbackCard({
  event,
  viewerRole,
  nav,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
  nav: BulkBatchNav;
}) {
  // `renderAsCard` in EventEntry already narrowed `to_phase` to KickbackPhase
  // via the `isDestructivePhase` type predicate.
  if (!isDestructivePhase(event.to_phase)) return null;
  const palette = kickbackPalette(event.to_phase);
  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border border-border-default border-l-[3px]",
        palette.leftBorder
      )}
    >
      <header className="flex flex-col gap-1.5 px-4 py-2.5 bg-bg-elevated/40 border-b border-border-default text-sm text-text-secondary leading-6">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-text-primary">
            {event.actor_name}
          </span>
          {event.is_bulk && (
            <BulkHint
              count={event.bulk_item_count}
              items={event.bulk_items}
              nav={nav}
            />
          )}
          <time
            className="ml-auto shrink-0 text-xs text-text-muted"
            dateTime={event.created_at}
            title={new Date(event.created_at).toLocaleString()}
          >
            {timeAgo(event.created_at)}
          </time>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <PhaseChangeText
            event={event}
            viewerRole={viewerRole}
            dropMovedVerb
          />
        </div>
      </header>
      <div className="flex gap-2.5 items-start px-4 py-3">
        <MessageSquareWarning
          className={cn("w-4 h-4 mt-0.5 shrink-0", palette.iconText)}
        />
        <p className="text-sm text-text-primary whitespace-pre-wrap break-words leading-relaxed min-w-0">
          {event.comment}
        </p>
      </div>
    </div>
  );
}

/**
 * Renders `moved <FromPill> → <ToPill>` (or `created in <ToPill>` for the
 * initial creation row). The verb is dropped only when the row is inside
 * a `KickbackCard` whose own framing carries the kick-back semantics.
 */
function PhaseChangeText({
  event,
  viewerRole,
  dropMovedVerb,
}: {
  event: BoqItemHistoryEvent;
  viewerRole: UserRole | null;
  dropMovedVerb: boolean;
}) {
  const toLabel = phaseToLabel(event.to_phase, viewerRole);
  const toVariant = phaseToVariant(event.to_phase, viewerRole);
  if (event.from_phase) {
    const fromLabel = phaseToLabel(event.from_phase, viewerRole);
    const fromVariant = phaseToVariant(event.from_phase, viewerRole);
    return (
      <>
        {!dropMovedVerb && <span>moved</span>}
        <Badge variant={fromVariant}>{fromLabel}</Badge>
        <ArrowRight className="w-3 h-3 text-text-muted self-center" />
        <Badge variant={toVariant}>{toLabel}</Badge>
      </>
    );
  }
  return (
    <>
      <span>created in</span>
      <Badge variant={toVariant}>{toLabel}</Badge>
    </>
  );
}

/**
 * Click opens a popover listing every BOQ item the bulk action touched.
 * Items other than the current one are clickable — the popover swaps the
 * open drawer to the clicked item via `nav.onOpenOtherItem`. Falls back
 * to a non-interactive label when the server returned no `bulk_items`
 * (e.g. legacy audit rows).
 */
function BulkHint({
  count,
  items,
  nav,
}: {
  count: number | null;
  items: BoqBulkItemRef[] | null;
  nav: BulkBatchNav;
}) {
  const label = count ? `${count} items` : "bulk";
  const pillClasses =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border-default bg-bg-elevated/40 text-[10px] font-semibold text-text-muted";
  if (!items || items.length === 0) {
    return (
      <span className={pillClasses}>
        <Layers className="w-2.5 h-2.5" />
        {label}
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            pillClasses,
            "cursor-pointer transition-colors hover:bg-bg-elevated/80 hover:text-text-secondary"
          )}
        >
          <Layers className="w-2.5 h-2.5" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[360px] p-0 overflow-hidden"
      >
        <header className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-elevated border-b border-border-default text-sm">
          <Layers className="w-3.5 h-3.5 text-text-muted" />
          <span className="font-semibold text-text-primary">
            {items.length} items in this batch
          </span>
        </header>
        <ul className="max-h-56 overflow-y-auto py-1">
          {items.map((it) => (
            <BatchItemRow
              key={it.id}
              item={it}
              isCurrent={it.id === nav.currentItemId}
              onOpen={nav.onOpenOtherItem}
            />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function BatchItemRow({
  item,
  isCurrent,
  onOpen,
}: {
  item: BoqBulkItemRef;
  isCurrent: boolean;
  onOpen?: (itemId: string) => void;
}) {
  const rowClasses = "flex items-baseline gap-3 px-3.5 py-1.5 text-xs";
  const content = (
    <>
      <span className="font-semibold text-text-primary tabular-nums shrink-0 w-16 truncate">
        {item.item_code}
      </span>
      <span className="text-text-secondary truncate">{item.description}</span>
      {isCurrent && (
        <span className="ml-auto shrink-0 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
          current
        </span>
      )}
    </>
  );
  if (isCurrent || !onOpen) {
    return <li className={rowClasses}>{content}</li>;
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className={cn(
          "w-full text-left cursor-pointer hover:bg-bg-elevated/60 transition-colors",
          rowClasses
        )}
      >
        {content}
      </button>
    </li>
  );
}

function EventSkeleton() {
  return (
    <div className="relative pl-9">
      <Skeleton className="absolute left-0 top-0 w-7 h-7 rounded-full ring-2 ring-bg-secondary" />
      <Skeleton className="h-3.5 w-3/4" />
    </div>
  );
}
