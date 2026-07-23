"use client";

import useSWR from "swr";
import { ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { API } from "@/lib/api/routes";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { timeAgo } from "@/lib/formatTime";
import type { BoqItemFieldChange, BoqItemVersion } from "@/types";
import type { BoqItemChangeReason } from "@/lib/validations";

const REASON_LABEL: Record<BoqItemChangeReason, string> = {
  quantity: "Quantity change",
  specification: "Spec change",
  other: "Edited",
};

interface Props {
  projectId: string;
  itemId: string;
}

/**
 * Immutable material-change history for a BOQ item (RFQ-3a), newest first —
 * every qty/spec/cost/dimension edit with who changed it, why, and the
 * before→after values. Rendered under the Activity tab's "Changes" sub-tab
 * (the phase timeline is the sibling "Timeline" sub-tab).
 */
export function BoqItemChangeHistory({ projectId, itemId }: Props) {
  const { data, isLoading } = useSWR<{ versions: BoqItemVersion[] }>(
    API.boqItemVersions(projectId, itemId)
  );
  const versions = data?.versions ?? [];

  if (isLoading) {
    return <Skeleton className="h-16 rounded-lg" />;
  }
  if (versions.length === 0) {
    return (
      <p className="text-xs italic text-text-muted">No field changes yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {versions.map((v) => (
        <VersionCard key={v.id} version={v} />
      ))}
    </ul>
  );
}

function VersionCard({ version }: { version: BoqItemVersion }) {
  return (
    <li className="rounded-lg border border-border-default px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <Avatar
          initials={deriveInitials(version.changed_by_name ?? "?")}
          color={avatarColor(version.changed_by ?? "")}
          size="sm"
        />
        <span className="text-sm font-medium text-text-primary">
          {version.changed_by_name ?? "Someone"}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted bg-bg-elevated rounded px-1.5 py-0.5">
          {REASON_LABEL[version.change_reason]}
        </span>
        <time
          className="ml-auto shrink-0 text-xs text-text-muted"
          dateTime={version.changed_at}
          title={new Date(version.changed_at).toLocaleString()}
        >
          {timeAgo(version.changed_at)}
        </time>
      </div>

      {version.changes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {version.changes.map((c) => (
            <FieldDiffRow key={c.field} change={c} />
          ))}
        </ul>
      )}

      {version.change_note && (
        <blockquote className="mt-2 border-l-2 border-border-light pl-3 py-0.5 text-sm text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
          {version.change_note}
        </blockquote>
      )}
    </li>
  );
}

function FieldDiffRow({ change }: { change: BoqItemFieldChange }) {
  return (
    <li className="flex items-center gap-2 text-xs text-text-secondary">
      <span className="text-text-muted w-28 shrink-0 truncate">
        {change.field}
      </span>
      <span className="tabular-nums line-through text-text-muted">
        {formatValue(change.from)}
      </span>
      <ArrowRight className="w-3 h-3 text-text-muted shrink-0" />
      <span className="tabular-nums font-medium text-text-primary">
        {formatValue(change.to)}
      </span>
    </li>
  );
}

function formatValue(value: string | number | null): string {
  if (value === null || value === "") return "—";
  return String(value);
}
