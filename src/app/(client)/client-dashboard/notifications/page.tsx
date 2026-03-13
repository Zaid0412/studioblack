"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Bell,
  MessageSquare,
  Upload,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

const typeIcons: Record<string, typeof Bell> = {
  comment: MessageSquare,
  upload: Upload,
  approval: CheckCircle2,
  review_requested: ClipboardCheck,
  review_submitted: AlertTriangle,
};

const typeColors: Record<string, string> = {
  comment: "bg-blue-500/10 text-blue-500",
  upload: "bg-green-500/10 text-green-500",
  approval: "bg-success/10 text-success",
  review_requested: "bg-orange-500/10 text-orange-500",
  review_submitted: "bg-purple-500/10 text-purple-500",
};

/** Client notifications page — shows real in-app notifications. */
export default function ClientNotificationsPage() {
  const t = useTranslations("notifications");
  const te = useTranslations("emptyStates");
  const router = useRouter();

  const [dbNotifs, setDbNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    async function loadDbNotifs() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const rows = await res.json();
        setDbNotifs(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rows.map((r: any) => ({
            id: r.id,
            type: r.type,
            title: r.title,
            description: r.description + (r.project_name ? ` · ${r.project_name}` : ""),
            read: r.read,
            createdAt: r.created_at,
            projectId: r.project_id,
          }))
        );
      } catch {
        // ignore
      }
    }
    loadDbNotifs();
    const interval = setInterval(loadDbNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] }),
      }).catch(() => {});
      setDbNotifs((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }
    if (notification.projectId) {
      router.push(`/client-dashboard/projects/${notification.projectId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
    setDbNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    toast({
      title: t("allCaughtUpToast"),
      description: t("allCaughtUpDescription"),
    });
  };

  const notifications = useMemo(
    () =>
      [...dbNotifs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [dbNotifs]
  );

  const today = useMemo(() => new Date().toDateString(), []);
  const yesterday = useMemo(
    () => new Date(new Date().getTime() - 86400000).toDateString(),
    []
  );

  const groups: { label: string; items: Notification[] }[] = [
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
          notifications.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
              {t("markAllRead")}
            </Button>
          ) : undefined
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
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-lg shrink-0",
                        typeColors[notification.type] || "bg-bg-elevated text-text-muted"
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

function formatTimeShort(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
