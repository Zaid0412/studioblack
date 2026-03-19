"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Bell,
  UserPlus,
  MessageSquare,
  Upload,
  CheckCircle2,
  ClipboardCheck,
  AlertTriangle,
  ListChecks,
  CheckCheck,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/formatTime";
import type { Notification, DbNotificationRow } from "@/types";

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
  invitation: "text-[#F5C518]",
  comment: "text-blue-400",
  upload: "text-green-400",
  approval: "text-green-400",
  review_requested: "text-orange-400",
  review_submitted: "text-purple-400",
  task_assigned: "text-indigo-400",
};

/** Notification bell + dropdown panel for the header bar. */
export function NotificationPanel() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [invitationNotifs, setInvitationNotifs] = useState<Notification[]>([]);
  const [dbNotifs, setDbNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [pendingInviteIds, setPendingInviteIds] = useState<Map<string, string>>(
    new Map()
  );

  const roleLabel = useCallback(
    (role: string) => {
      if (role === "owner") return t("roleOwner");
      if (role === "admin") return t("rolePM");
      if (role === "member") return t("roleArchitect");
      return role;
    },
    [t]
  );

  const loadInvitations = useCallback(async () => {
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
  }, [t, roleLabel]);

  const loadDbNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const rows = await res.json();
      setDbNotifs(
        rows.map((r: DbNotificationRow) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          description:
            r.description + (r.project_name ? ` · ${r.project_name}` : ""),
          read: r.read,
          createdAt: r.created_at,
          projectId: r.project_id,
        }))
      );
    } catch {
      // ignore
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    async function load() {
      await Promise.all([loadInvitations(), loadDbNotifs()]);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    const handleRefresh = () => load();
    window.addEventListener("notifications-changed", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-changed", handleRefresh);
    };
  }, [loadInvitations, loadDbNotifs]);

  const notifications: Notification[] = useMemo(
    () =>
      [...invitationNotifs, ...dbNotifs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [invitationNotifs, dbNotifs]
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const [today] = useState(() => new Date().toDateString());
  const [yesterday] = useState(() =>
    new Date(new Date().getTime() - 86400000).toDateString()
  );

  const groups = useMemo(
    () =>
      [
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
      ].filter((g) => g.items.length > 0),
    [notifications, today, yesterday, t]
  );

  const handleNotificationClick = async (notification: Notification) => {
    if (
      !notification.read &&
      !notification.id.startsWith("recv-") &&
      !notification.id.startsWith("sent-")
    ) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notification.id] }),
      }).catch(() => {});
      setDbNotifs((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      window.dispatchEvent(new Event("notifications-changed"));
    }
    if (notification.projectId) {
      setOpen(false);
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
    window.dispatchEvent(new Event("notifications-changed"));
    toast({
      title: t("allCaughtUpToast"),
      description: t("allCaughtUpDescription"),
    });
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("clearAllConfirm"))) return;
    await fetch("/api/notifications", { method: "DELETE" }).catch(() => {});
    setDbNotifs([]);
    setInvitationNotifs([]);
    setPendingInviteIds(new Map());
    window.dispatchEvent(new Event("notifications-changed"));
  };

  const handleDeleteOne = async (notifId: string) => {
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notifId }),
    }).catch(() => {});
    setDbNotifs((prev) => prev.filter((n) => n.id !== notifId));
    window.dispatchEvent(new Event("notifications-changed"));
  };

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
    setOpen(false);
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-2 rounded-lg transition-colors cursor-pointer",
            open
              ? "text-white bg-[#1A1A1A]"
              : "text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]"
          )}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#F5C518] text-[#0D0D0D] text-[10px] font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[400px] p-0 border-[#333333] bg-[#141414] rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-[52px] px-5 border-b border-[#222222]">
          <span className="text-[15px] font-semibold text-white">
            {t("title")}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1A1A1A] text-[#666666] hover:text-[#A0A0A0] transition-colors text-xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t("markAllRead")}
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1A1A1A] text-[#666666] hover:text-red-400 transition-colors text-xs cursor-pointer"
              title={t("clearAll")}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[440px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#666666]" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Bell className="w-8 h-8 text-[#333333]" />
              <span className="text-sm text-[#666666]">
                {t("noNotifications")}
              </span>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center h-9 px-5">
                  <span className="text-[11px] font-semibold text-[#666666] uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                {group.items.map((notification, idx) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  const iconColor =
                    typeColors[notification.type] || "text-[#666666]";
                  const isUnread = !notification.read;
                  return (
                    <div key={notification.id}>
                      {idx > 0 && <div className="h-px bg-[#222222] mx-5" />}
                      <div
                        className={cn(
                          "flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors",
                          isUnread && "bg-[#1A1A1A]/50"
                        )}
                        onClick={() => handleNotificationClick(notification)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleNotificationClick(notification);
                          }
                        }}
                      >
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-[#F5C518] shrink-0 mt-1.5" />
                        )}
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span
                            className={cn(
                              "text-[13px] leading-tight",
                              isUnread
                                ? "font-medium text-white"
                                : "text-[#A0A0A0]"
                            )}
                          >
                            {notification.title}
                          </span>
                          <span
                            className={cn(
                              "text-xs leading-snug line-clamp-2",
                              isUnread ? "text-[#8A8A8A]" : "text-[#666666]"
                            )}
                          >
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
                          <span className="text-[11px] text-[#5A5A5A]">
                            {relativeTime(notification.createdAt)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Icon className={cn("w-4 h-4 mt-0.5", iconColor)} />
                          {!notification.id.startsWith("recv-") &&
                            !notification.id.startsWith("sent-") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteOne(notification.id);
                                }}
                                className="p-0.5 rounded text-[#444444] hover:text-red-400 transition-colors cursor-pointer"
                                aria-label="Delete notification"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
