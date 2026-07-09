"use client";

import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { API } from "@/lib/api/routes";
import { avatarColor } from "@/lib/avatarUtils";
import { deriveInitials } from "@/lib/utils";
import { timeAgo } from "@/lib/formatTime";
import type { RateContractHistoryEvent } from "@/types";

/** Maps a `rate_contract.<x>` audit action to its i18n phrasing suffix. */
function actionKey(action: string): string {
  const suffix = action.startsWith("rate_contract.")
    ? action.slice("rate_contract.".length)
    : action;
  const known = new Set([
    "created",
    "updated",
    "activated",
    "cancelled",
    "transitioned",
    "items_upserted",
    "item_removed",
  ]);
  return known.has(suffix) ? `activity_${suffix}` : "activity_unknown";
}

interface Props {
  contractId: string;
}

/**
 * Activity timeline for a rate contract — every `rate_contract.*` audit event,
 * newest first, with who did it and when. Studio-only; the events are already
 * written by the mutation routes (create / update / transition / items), this
 * just surfaces them. Renders a heading + empty state so it's always present.
 */
export function RateContractActivity({ contractId }: Props) {
  const t = useTranslations("rateContracts");
  const { data, isLoading } = useSWR<{ events: RateContractHistoryEvent[] }>(
    API.rateContractHistory(contractId)
  );
  const events = data?.events ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-text-primary">
        {t("activityTitle")}
      </h3>
      {isLoading ? (
        <Skeleton className="h-16 rounded-lg" />
      ) : events.length === 0 ? (
        <p className="text-sm text-text-muted">{t("activityEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => {
            const name = e.actor_name ?? "—";
            return (
              <li key={e.id} className="flex items-start gap-3">
                <Avatar
                  initials={deriveInitials(name)}
                  color={avatarColor(e.actor_id ?? name)}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary">
                    <span className="font-medium">{name}</span>{" "}
                    <span className="text-text-secondary">
                      {t(actionKey(e.action))}
                    </span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {timeAgo(e.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
