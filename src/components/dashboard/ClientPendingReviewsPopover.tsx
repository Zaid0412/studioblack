"use client";

import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { API } from "@/lib/api/routes";
import { timeAgo } from "@/lib/formatTime";
import { cn } from "@/lib/utils";
import { DEFAULT_BOQ_SEGMENT } from "@/app/(dashboard)/projects/[id]/boq/_lib/tabs";
import type {
  ClientPendingFileRow,
  ClientPendingBoqRow,
} from "@/lib/queries/dashboard";

interface ClientPendingReviewsPopoverProps {
  count: number;
  label: string;
}

interface ClientPendingReviewsResponse {
  files: ClientPendingFileRow[];
  boqs: ClientPendingBoqRow[];
}

/**
 * Client variant of `PendingReviewsPopover` — same shell, scoped to the
 * caller's projects via `/api/client/pending-reviews`. Rows deep-link to
 * the same review surfaces clients already use elsewhere in the app.
 */
export function ClientPendingReviewsPopover({
  count,
  label,
}: ClientPendingReviewsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative w-full text-left flex flex-col gap-2",
            "rounded-xl bg-bg-elevated p-5 cursor-pointer",
            "ring-1 ring-accent/30 hover:ring-accent transition-all",
            "hover:bg-bg-elevated/70 data-[state=open]:ring-accent",
            "outline-none focus-visible:ring-2 focus-visible:ring-accent"
          )}
          aria-label={`${label}: ${count}. Click to see the queue.`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-text-muted">{label}</span>
            <ClipboardCheck className="w-4 h-4 text-accent" />
          </div>
          <span className="text-[32px] font-bold text-accent leading-none">
            {count}
          </span>
          <span className="self-end inline-flex items-center gap-1 text-[11px] font-semibold text-accent group-hover:gap-1.5 transition-all">
            View list
            <ChevronDown className="w-3 h-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[420px] p-0 overflow-hidden"
      >
        <PopoverBody totalCount={count} />
      </PopoverContent>
    </Popover>
  );
}

function PopoverBody({ totalCount }: { totalCount: number }) {
  // Suppress the global `onError` toast (`src/lib/swr.ts`) — popover
  // renders its own `ErrorView` inline.
  const { data, isLoading, error } = useSWR<ClientPendingReviewsResponse>(
    API.clientPendingReviews(),
    { onError: () => {} }
  );

  const fileCount = data?.files.length ?? 0;
  const boqCount = data?.boqs.length ?? 0;
  const shown = fileCount + boqCount;
  const truncated = data && shown < totalCount;
  const isEmpty = data && shown === 0;

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-border-default">
        <span className="text-[13px] font-semibold text-text-primary">
          Pending Reviews
        </span>
        {data && (
          <span className="text-xs font-bold text-accent tabular-nums">
            {truncated ? `${shown} of ${totalCount}` : shown}
          </span>
        )}
      </header>
      <div className="max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorView />
        ) : isEmpty ? (
          <EmptyView />
        ) : (
          <>
            {fileCount > 0 && (
              <Section title="Files" count={fileCount}>
                {data!.files.map((row) => (
                  <FileReviewRow key={row.id} row={row} />
                ))}
              </Section>
            )}
            {boqCount > 0 && (
              <Section title="BOQs" count={boqCount}>
                {data!.boqs.map((row) => (
                  <BoqReviewRow key={row.id} row={row} />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted bg-bg-elevated/40 border-b border-border-default">
        {title} ({count})
      </h3>
      <ul>{children}</ul>
    </section>
  );
}

function FileReviewRow({ row }: { row: ClientPendingFileRow }) {
  return (
    <li>
      <Link
        href={`/projects/${row.project_id}/review/${row.id}`}
        className="flex items-start gap-3 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors"
      >
        <FileText className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-text-primary truncate">
            {row.file_name}
          </span>
          <span className="text-xs text-text-muted truncate">
            {row.project_name}
            {" · "}
            {timeAgo(row.sent_at)}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-1" />
      </Link>
    </li>
  );
}

function BoqReviewRow({ row }: { row: ClientPendingBoqRow }) {
  return (
    <li>
      <Link
        href={`/projects/${row.project_id}/boq/${DEFAULT_BOQ_SEGMENT}`}
        className="flex items-start gap-3 px-4 py-3 border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors"
      >
        <ScrollText className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-text-primary truncate">
            BOQ — {row.project_name}
          </span>
          <span className="text-xs text-text-muted truncate">
            {row.items_in_review} item{row.items_in_review === 1 ? "" : "s"} ·{" "}
            {timeAgo(row.submitted_at)}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted shrink-0 mt-1" />
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 px-4 py-3 border-b border-border-default last:border-b-0"
        >
          <Skeleton className="w-4 h-4 rounded shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyView() {
  return (
    <EmptyState
      icon={ClipboardCheck}
      title="Nothing pending"
      description="Files and BOQs awaiting your review will appear here."
      className="!py-8"
    />
  );
}

function ErrorView() {
  return (
    <EmptyState
      icon={ClipboardCheck}
      title="Couldn't load the queue"
      description="Try again in a moment."
      className="!py-8"
    />
  );
}
