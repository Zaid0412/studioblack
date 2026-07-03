"use client";

import { useTranslations } from "next-intl";
import {
  Award,
  Ban,
  FilePlus2,
  GitBranch,
  Mail,
  MessageSquareReply,
  UserPlus2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/formatTime";
import type { RfqEvent } from "@/types";

interface Props {
  events: readonly RfqEvent[];
}

const ICONS: Record<string, LucideIcon> = {
  "rfq.created": FilePlus2,
  "rfq.issued": Mail,
  "rfq.vendors_added": UserPlus2,
  "rfq.cancelled": Ban,
  "rfq.revised": GitBranch,
  "rfq.awarded": Award,
  "quote.submitted": MessageSquareReply,
  "quote.revised": MessageSquareReply,
  "quote.awarded": Award,
};

/**
 * Vertical rail timeline matching the task-detail UX. Each event hangs off
 * the rail with a small circular icon bullet. The rail line itself is
 * drawn behind the bullets via an absolute child on the `<ol>`.
 *
 * Studio side shows full actor names and vendor pills on "Issued" rows.
 * Vendor side receives actor info intact (server strips competitive vendor
 * identifiers but preserves studio actor names via `getRfqDetailForVendor`).
 */
export function RfqStatusTimeline({ events }: Props) {
  const t = useTranslations("rfq.timeline");

  if (events.length === 0) {
    return (
      <p className="px-6 py-8 text-sm text-text-muted text-center">
        {t("empty")}
      </p>
    );
  }

  return (
    <ol className="px-6 py-5 relative flex flex-col gap-3">
      {/* Vertical guide line — sits behind the bullets. */}
      <span
        aria-hidden="true"
        className="absolute left-[36px] top-7 bottom-7 w-px bg-border-default"
      />
      {events.map((ev) => (
        <EventRow key={ev.id} event={ev} t={t} />
      ))}
    </ol>
  );
}

function EventRow({
  event,
  t,
}: {
  event: RfqEvent;
  t: ReturnType<typeof useTranslations>;
}) {
  const Icon = ICONS[event.action] ?? FilePlus2;
  const actor = event.actorName ?? t("someone");

  return (
    <li className="relative pl-10">
      <span className="absolute left-0 top-0.5 w-7 h-7 rounded-full bg-bg-elevated ring-2 ring-bg-secondary flex items-center justify-center text-text-muted z-10">
        <Icon className="w-3.5 h-3.5 text-accent" />
      </span>
      <div className="flex items-baseline gap-1.5 flex-wrap text-sm text-text-secondary leading-6">
        <span className="font-medium text-text-primary">{actor}</span>
        <EventBody event={event} t={t} />
        <span className="text-xs text-text-muted">·</span>
        <time
          className="text-xs text-text-muted"
          dateTime={event.createdAt}
          title={new Date(event.createdAt).toLocaleString()}
        >
          {timeAgo(event.createdAt)}
        </time>
      </div>
    </li>
  );
}

/** Verb + value-pill phrase, varies by action type. */
function EventBody({
  event,
  t,
}: {
  event: RfqEvent;
  t: ReturnType<typeof useTranslations>;
}) {
  const m = event.metadata ?? {};
  switch (event.action) {
    case "rfq.created": {
      const itemCount = Number(m.item_count ?? 0);
      return (
        <>
          <span>{t("createdVerb")}</span>
          <Pill>{t("itemsCount", { count: itemCount })}</Pill>
        </>
      );
    }
    case "rfq.issued":
    case "rfq.vendors_added": {
      const verb =
        event.action === "rfq.issued" ? t("issuedVerb") : t("vendorsAddedVerb");
      const names = Array.isArray(m.vendor_names)
        ? (m.vendor_names as (string | null)[]).filter(
            (n): n is string => typeof n === "string" && n.length > 0
          )
        : [];
      const ids = Array.isArray(m.vendor_ids) ? (m.vendor_ids as string[]) : [];
      const count =
        names.length > 0
          ? names.length
          : ids.length > 0
            ? ids.length
            : Number(m.invited_contact_count ?? 0);
      return (
        <>
          <span>{verb}</span>
          {names.length > 0 ? (
            <>
              {names.map((n, i) => (
                <Pill key={`${n}-${i}`}>{n}</Pill>
              ))}
            </>
          ) : (
            <Pill>{t("vendorsCount", { count })}</Pill>
          )}
        </>
      );
    }
    case "rfq.cancelled": {
      const reason = typeof m.reason === "string" ? m.reason : null;
      return reason ? (
        <>
          <span>{t("cancelledVerb")}</span>
          <Pill>{reason}</Pill>
        </>
      ) : (
        <span>{t("cancelledVerb")}</span>
      );
    }
    case "rfq.revised": {
      const rev = Number(m.revision_number ?? 0);
      const reason = typeof m.reason === "string" ? m.reason : null;
      return (
        <>
          <span>{t("revisedVerb")}</span>
          {rev > 0 && <Pill>{t("revPill", { rev })}</Pill>}
          {reason && <Pill>{reason}</Pill>}
        </>
      );
    }
    case "quote.submitted":
    case "quote.revised": {
      const vendorName =
        typeof m.vendor_name === "string" ? m.vendor_name : null;
      const verb =
        event.action === "quote.submitted"
          ? t("quoteSubmittedVerb")
          : t("quoteRevisedVerb");
      return (
        <>
          <span>{verb}</span>
          {vendorName && <Pill>{vendorName}</Pill>}
        </>
      );
    }
    case "rfq.awarded": {
      const awardType = typeof m.award_type === "string" ? m.award_type : null;
      const winningName =
        typeof m.winning_vendor_name === "string"
          ? m.winning_vendor_name
          : null;
      return (
        <>
          <span>{t("rfqAwardedVerb")}</span>
          {awardType === "split" ? (
            <Pill>{t("splitAward")}</Pill>
          ) : (
            winningName && <Pill>{winningName}</Pill>
          )}
        </>
      );
    }
    case "quote.awarded": {
      const vendorName =
        typeof m.vendor_name === "string" ? m.vendor_name : null;
      return (
        <>
          <span>{t("quoteAwardedVerb")}</span>
          {vendorName && <Pill>{vendorName}</Pill>}
        </>
      );
    }
    default:
      return <span className="font-mono text-xs">{event.action}</span>;
  }
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="draft" className="font-normal">
      {children}
    </Badge>
  );
}
