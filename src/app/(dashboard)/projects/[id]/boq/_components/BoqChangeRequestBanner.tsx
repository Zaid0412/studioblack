"use client";

import useSWR from "swr";
import { AlertTriangle } from "lucide-react";
import { API } from "@/lib/api/routes";
import type { BoqItemChangeRequestEvent } from "@/lib/api/boq";
import { relativeTime } from "@/lib/formatTime";
import { cn } from "@/lib/utils";
import { kickbackPalette } from "../_lib/formatters";

interface BoqChangeRequestBannerProps {
  projectId: string;
  itemId: string;
}

/**
 * Persistent banner shown at the top of the BOQ item drawer when the item
 * is currently in one of the `*_changes_requested` phases. Surfaces the
 * actor + relative time + comment so the message survives past the
 * transient in-app notification.
 *
 * Reads from `audit_event` via `latest-change-request` — covers both
 * single-item and bulk transitions.
 */
export function BoqChangeRequestBanner({
  projectId,
  itemId,
}: BoqChangeRequestBannerProps) {
  const { data, isLoading, error } = useSWR<BoqItemChangeRequestEvent | null>(
    API.boqItemLatestChangeRequest(projectId, itemId)
  );

  if (isLoading) return null;
  if (error) {
    return (
      <div
        className="flex gap-3 rounded-md border-l-4 border-l-border-default bg-bg-subtle px-4 py-3 text-text-muted"
        role="status"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-sm">Couldn&apos;t load change-request context.</p>
      </div>
    );
  }
  if (!data) return null;

  const who = data.actor_name?.trim() || "Someone";
  const fromClient = data.to_phase === "client_changes_requested";
  const palette = kickbackPalette(data.to_phase);

  return (
    <div
      className={cn(
        "flex gap-3 rounded-md border-l-4 px-4 py-3",
        palette.leftBorder,
        palette.bgTint
      )}
      role="status"
    >
      <AlertTriangle
        className={cn("h-5 w-5 shrink-0 mt-0.5", palette.iconText)}
      />
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary">
          {fromClient ? "Client requested changes" : "Changes requested"} ·{" "}
          <span className="font-normal text-text-secondary">
            {who} · {relativeTime(data.created_at)}
          </span>
        </p>
        {data.comment ? (
          <blockquote className="text-sm text-text-secondary border-l-2 border-text-muted/30 pl-3 italic whitespace-pre-wrap break-words">
            {data.comment}
          </blockquote>
        ) : (
          <p className="text-xs text-text-muted">No reason was provided.</p>
        )}
      </div>
    </div>
  );
}
