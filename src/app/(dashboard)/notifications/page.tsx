"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  ClipboardCheck,
  MessageSquare,
  CheckCircle2,
  Upload,
  Calendar,
  Users,
  Bell,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { notifications } from "@/data/mock";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof Bell> = {
  review: ClipboardCheck,
  comment: MessageSquare,
  approval: CheckCircle2,
  upload: Upload,
  deadline: Calendar,
  team: Users,
};

const typeColors: Record<string, string> = {
  review: "bg-info/10 text-info",
  comment: "bg-accent/10 text-accent",
  approval: "bg-success/10 text-success",
  upload: "bg-status-submitted/10 text-status-submitted",
  deadline: "bg-warning/10 text-warning",
  team: "bg-status-draft/10 text-text-secondary",
};

/**
 *
 */
export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const te = useTranslations("emptyStates");

  // Group by date
  const today = useMemo(() => new Date().toDateString(), []);
  const yesterday = useMemo(
    () => new Date(new Date().getTime() - 86400000).toDateString(),
    []
  );

  const groups: { label: string; items: typeof notifications }[] = [
    {
      label: t("today"),
      items: notifications.filter(
        (n) => new Date(n.createdAt).toDateString() === today
      ),
    },
    {
      label: t("yesterday"),
      items: notifications.filter(
        (n) => new Date(n.createdAt).toDateString() === yesterday
      ),
    },
    {
      label: t("earlier"),
      items: notifications.filter((n) => {
        const date = new Date(n.createdAt).toDateString();
        return date !== today && date !== yesterday;
      }),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              toast({
                title: t("allCaughtUpToast"),
                description: t("allCaughtUpDescription"),
              })
            }
          >
            {t("markAllRead")}
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {groups.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={te("notificationsTitle")}
            description={te("notificationsDescription")}
          />
        ) : (
          groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider px-1 mb-2">
                {group.label}
              </h3>
              {group.items.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-4 py-3 transition-colors cursor-pointer hover:bg-bg-elevated/50",
                      !notification.read && "bg-bg-secondary"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                        typeColors[notification.type]
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm",
                            !notification.read
                              ? "font-semibold text-text-primary"
                              : "font-medium text-text-secondary"
                          )}
                        >
                          {notification.title}
                        </span>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                        )}
                      </div>
                      <span className="text-xs text-text-muted line-clamp-1">
                        {notification.description}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted shrink-0 mt-0.5">
                      {formatTimeShort(notification.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Formats an ISO timestamp as a short 12-hour time string (e.g. "2:30 PM").
 *
 * Used in notification list items to show when each notification arrived.
 */
function formatTimeShort(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
