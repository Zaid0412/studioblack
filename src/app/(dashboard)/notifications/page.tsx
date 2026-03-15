"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Bell,
  MessageSquare,
  Upload,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  ListChecks,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

interface DbNotificationRow {
  id: string;
  type: string;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
  project_id: string | null;
  project_name: string | null;
}

const typeIcons: Record<string, typeof Bell> = {
  invitation: UserPlus,
  comment: MessageSquare,
  upload: Upload,
  approval: CheckCircle2,
  review_requested: ClipboardCheck,
  review_submitted: AlertTriangle,
  task_assigned: ListChecks,
};

const typeColors: Record<string, string> = {
  invitation: "bg-accent/10 text-accent",
  comment: "bg-blue-500/10 text-blue-500",
  upload: "bg-green-500/10 text-green-500",
  approval: "bg-success/10 text-success",
  review_requested: "bg-orange-500/10 text-orange-500",
  review_submitted: "bg-purple-500/10 text-purple-500",
  task_assigned: "bg-indigo-500/10 text-indigo-500",
};

/** Notifications feed — invitation + in-app notifications, grouped by date. */
export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const te = useTranslations("emptyStates");

  const router = useRouter();
  const [invitationNotifs, setInvitationNotifs] = useState<Notification[]>([]);
  const [dbNotifs, setDbNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [pendingInviteIds, setPendingInviteIds] = useState<Map<string, string>>(
    new Map()
  );

  const roleLabel = (role: string) => {
    if (role === "owner") return t("roleOwner");
    if (role === "admin") return t("rolePM");
    if (role === "member") return t("roleArchitect");
    return role;
  };

  // Fetch invitation notifications
  useEffect(() => {
    async function loadInvitations() {
      const allNotifs: Notification[] = [];
      const idMap = new Map<string, string>();

      const { data: received } =
        await authClient.organization.listUserInvitations();
      if (received) {
        for (const inv of received) {
          if (inv.status !== "pending") continue;
          const notifId = `recv-${inv.id}`;
          allNotifs.push({
            id: notifId,
            title: t("invitationReceived"),
            description: `${inv.organizationName ?? inv.organizationId} — ${roleLabel(inv.role ?? "member")}`,
            type: "invitation",
            read: false,
            createdAt: new Date(inv.createdAt).toISOString(),
          });
          idMap.set(notifId, inv.id);
        }
      }

      const { data: orgData } =
        await authClient.organization.getFullOrganization();
      if (orgData?.invitations) {
        for (const inv of orgData.invitations) {
          if (inv.status !== "pending") continue;
          allNotifs.push({
            id: `sent-${inv.id}`,
            title: t("invitationSent"),
            description: `${inv.email} — ${roleLabel(inv.role ?? "member")}`,
            type: "invitation",
            read: false,
            createdAt: new Date(inv.createdAt).toISOString(),
          });
        }
      }

      setInvitationNotifs(allNotifs);
      setPendingInviteIds(idMap);
      setLoading(false);
    }
    loadInvitations();
    const interval = setInterval(loadInvitations, 30000);
    return () => clearInterval(interval);
  }, [t]);

  // Fetch DB notifications
  useEffect(() => {
    async function loadDbNotifs() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const rows = await res.json();
        setDbNotifs(
          rows.map((r: DbNotificationRow) => ({
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
    const interval = setInterval(loadDbNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAcceptInvite = async (notifId: string) => {
    const invitationId = pendingInviteIds.get(notifId);
    if (!invitationId) return;
    setLoadingIds((prev) => new Set(prev).add(notifId));
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    if (error) {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(notifId);
        return next;
      });
      toast({
        title: t("acceptError"),
        description: error.message ?? "",
        variant: "error",
      });
      return;
    }
    toast({
      title: t("invitationAccepted"),
      description: t("invitationAcceptedDesc"),
      variant: "success",
    });
    setInvitationNotifs((prev) => prev.filter((n) => n.id !== notifId));
    setPendingInviteIds((prev) => {
      const next = new Map(prev);
      next.delete(notifId);
      return next;
    });
    window.dispatchEvent(new Event("notifications-changed"));
    router.push("/organisation");
  };

  const handleRejectInvite = async (notifId: string) => {
    const invitationId = pendingInviteIds.get(notifId);
    if (!invitationId) return;
    setLoadingIds((prev) => new Set(prev).add(notifId));
    const { error } = await authClient.organization.rejectInvitation({
      invitationId,
    });
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(notifId);
      return next;
    });
    if (error) {
      toast({
        title: t("rejectError"),
        description: error.message ?? "",
        variant: "error",
      });
      return;
    }
    toast({
      title: t("invitationRejected"),
      description: t("invitationRejectedDesc"),
    });
    setInvitationNotifs((prev) => prev.filter((n) => n.id !== notifId));
    setPendingInviteIds((prev) => {
      const next = new Map(prev);
      next.delete(notifId);
      return next;
    });
    window.dispatchEvent(new Event("notifications-changed"));
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if it's a DB notification (has UUID format id)
    if (!notification.read && !notification.id.startsWith("recv-") && !notification.id.startsWith("sent-")) {
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
      router.push(`/projects/${notification.projectId}`);
    }
  };

  const handleMarkAllRead = async () => {
    setInvitationNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
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

  const notifications: Notification[] = useMemo(
    () =>
      [...invitationNotifs, ...dbNotifs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [invitationNotifs, dbNotifs]
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
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            {t("markAllRead")}
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
          </div>
        ) : groups.length === 0 ? (
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
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNotificationClick(notification); } }}
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
                      {pendingInviteIds.has(notification.id) && (
                        <div className="flex gap-2 mt-1.5">
                          <Button
                            size="sm"
                            disabled={loadingIds.has(notification.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAcceptInvite(notification.id);
                            }}
                          >
                            {loadingIds.has(notification.id)
                              ? "..."
                              : t("accept")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={loadingIds.has(notification.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRejectInvite(notification.id);
                            }}
                          >
                            {t("reject")}
                          </Button>
                        </div>
                      )}
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
