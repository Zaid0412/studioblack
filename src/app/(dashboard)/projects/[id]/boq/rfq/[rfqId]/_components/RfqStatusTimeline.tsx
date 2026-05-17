"use client";

import { useTranslations } from "next-intl";
import { Ban, FilePlus2, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/formatDate";
import type { RfqEvent } from "@/types";

interface Props {
  events: readonly RfqEvent[];
  /**
   * When true, the timeline renders without actor names (used in the vendor
   * portal where competitive info is stripped server-side anyway).
   */
  hideActor?: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  "rfq.created": FilePlus2,
  "rfq.issued": Mail,
  "rfq.cancelled": Ban,
};

/**
 * Vertical timeline of the RFQ's audit events. Renders oldest-first so the
 * story reads top-to-bottom. Each row has an icon, a localised one-line
 * summary, and a timestamp. Unknown actions are skipped (defence in depth
 * against future audit kinds the UI doesn't know about yet).
 */
export function RfqStatusTimeline({ events, hideActor }: Props) {
  const t = useTranslations("rfq.timeline");

  if (events.length === 0) {
    return (
      <p className="px-6 py-8 text-sm text-text-muted text-center">
        {t("empty")}
      </p>
    );
  }

  return (
    <ol className="px-6 py-4 flex flex-col gap-4 relative">
      {/* Vertical guide line — sits behind the icons. */}
      <span
        aria-hidden="true"
        className="absolute left-[34px] top-6 bottom-6 w-px bg-border-default"
      />
      {events.map((ev) => {
        const Icon = ICONS[ev.action] ?? FilePlus2;
        return (
          <li key={ev.id} className="flex items-start gap-3 relative">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-elevated border border-border-default shrink-0 z-10">
              <Icon className="h-4 w-4 text-accent" />
            </span>
            <div className="flex-1 min-w-0 pt-1">
              <div className="text-sm text-text-primary">
                {renderLabel(ev, hideActor, t)}
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                {formatDateTime(ev.createdAt)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Compose the one-line summary from an event's action + metadata. */
function renderLabel(
  ev: RfqEvent,
  hideActor: boolean | undefined,
  t: ReturnType<typeof useTranslations>
): string {
  const actor = !hideActor && ev.actorName ? ev.actorName : t("someone");
  const meta = ev.metadata ?? {};
  switch (ev.action) {
    case "rfq.created": {
      const itemCount = Number(meta.item_count ?? 0);
      return t("created", { actor, count: itemCount });
    }
    case "rfq.issued": {
      const vendorCount = Array.isArray(meta.vendor_ids)
        ? meta.vendor_ids.length
        : Number(meta.invited_contact_count ?? 0);
      return t("issued", { actor, count: vendorCount });
    }
    case "rfq.cancelled": {
      const reason = typeof meta.reason === "string" ? meta.reason : null;
      return reason
        ? t("cancelledWithReason", { actor, reason })
        : t("cancelled", { actor });
    }
    default:
      return ev.action;
  }
}
