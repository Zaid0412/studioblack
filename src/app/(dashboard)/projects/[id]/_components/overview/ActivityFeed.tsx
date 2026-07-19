"use client";

import { useTranslations } from "next-intl";
import { Upload, CheckCircle2, XCircle, FileClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { timeAgo } from "@/lib/formatTime";
import type { OverviewActivityItem } from "@/types";
import { OverviewCard } from "./OverviewCard";

interface ActivityFeedProps {
  items: OverviewActivityItem[];
}

/** Icon + verb-key for one activity row, from its kind + review decision. */
function descriptor(item: OverviewActivityItem): {
  Icon: LucideIcon;
  iconClass: string;
  verbKey: string;
} {
  if (item.kind === "upload") {
    return {
      Icon: Upload,
      iconClass: "text-info",
      verbKey: "activityUploaded",
    };
  }
  if (item.status === "approved") {
    return {
      Icon: CheckCircle2,
      iconClass: "text-success",
      verbKey: "activityApproved",
    };
  }
  if (item.status === "rejected") {
    return {
      Icon: XCircle,
      iconClass: "text-error",
      verbKey: "activityRequestedChanges",
    };
  }
  return {
    Icon: FileClock,
    iconClass: "text-text-muted",
    verbKey: "activityReviewed",
  };
}

/** Recent uploads + review decisions on the project. */
export function ActivityFeed({ items }: ActivityFeedProps) {
  const t = useTranslations("projectOverview");

  return (
    <OverviewCard title={t("recentActivity")}>
      {items.length === 0 ? (
        <p className="text-[13px] text-text-muted">{t("noActivity")}</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {items.map((item) => {
            const { Icon, iconClass, verbKey } = descriptor(item);
            return (
              <li key={item.id} className="flex items-start gap-3">
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-text-secondary">
                    <span className="font-medium text-text-primary">
                      {item.actor ?? t("someone")}
                    </span>{" "}
                    {t(verbKey)}{" "}
                    {item.fileName && (
                      <span className="font-medium text-text-primary">
                        {item.fileName}
                      </span>
                    )}
                  </p>
                  <span className="text-[11px] text-text-muted">
                    {timeAgo(item.at)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </OverviewCard>
  );
}
