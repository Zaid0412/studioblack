import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import { notifications as notificationsApi } from "@/lib/api";
import type { Notification, DbNotificationRow } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationFn = (key: string, values?: any) => string;

export interface UseNotificationsOptions {
  t: TranslationFn;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

/**
 *
 */
export function useNotifications({
  t,
  onNavigate,
  onClose,
}: UseNotificationsOptions) {
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
      const rows = await notificationsApi.list();
      setDbNotifs(
        rows.map((r: DbNotificationRow) => ({
          id: r.id,
          type: r.type as Notification["type"],
          title: r.title,
          description:
            r.description + (r.project_name ? ` · ${r.project_name}` : ""),
          read: r.read,
          createdAt: r.created_at,
          projectId: r.project_id ?? undefined,
        }))
      );
    } catch (e) {
      console.error("Failed to load notifications", e);
    }
  }, []);

  // Initial load + polling + event listener
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
      await notificationsApi.markRead([notification.id]).catch(() => {});
      setDbNotifs((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
      window.dispatchEvent(new Event("notifications-changed"));
    }
    if (notification.projectId) {
      onClose();
      onNavigate(`/projects/${notification.projectId}`);
    }
  };

  const handleMarkAllRead = async () => {
    setInvitationNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setDbNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    window.dispatchEvent(new Event("notifications-changed"));
    await notificationsApi.markAllRead().catch(() => {});
    toast({
      title: t("allCaughtUpToast"),
      description: t("allCaughtUpDescription"),
    });
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("clearAllConfirm"))) return;
    await notificationsApi.clearAll().catch(() => {});
    setDbNotifs([]);
    setInvitationNotifs([]);
    setPendingInviteIds(new Map());
    window.dispatchEvent(new Event("notifications-changed"));
  };

  const handleDeleteOne = async (notifId: string) => {
    await notificationsApi.remove(notifId).catch(() => {});
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
    onClose();
    onNavigate("/organisation");
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

  return {
    loading,
    notifications,
    unreadCount,
    groups,
    loadingIds,
    pendingInviteIds,
    handleNotificationClick,
    handleMarkAllRead,
    handleClearAll,
    handleDeleteOne,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
