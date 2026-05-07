"use client";

import { AlertCircle } from "lucide-react";

interface BoqInternalReviewBannerProps {
  reviewerName: string | null;
  comment: string | null;
  requestedAt: string | null;
}

/**
 * Inline alert banner shown above the BOQ table when the most recent
 * review action was "request changes". Stays sticky until the creator
 * resubmits. Carries the reviewer's name + comment so the creator sees
 * the rejection reason without opening the audit history.
 */
export function BoqInternalReviewBanner({
  reviewerName,
  comment,
  requestedAt,
}: BoqInternalReviewBannerProps) {
  if (!comment) return null;
  const when = requestedAt ? formatRelative(requestedAt) : null;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 px-4 py-3"
    >
      <AlertCircle
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 flex-none text-error"
      />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="text-xs font-semibold text-error">
          {reviewerName ?? "A reviewer"} requested changes
          {when && (
            <span className="ml-2 text-error/80 font-normal">· {when}</span>
          )}
        </div>
        <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap break-words">
          {comment}
        </p>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
