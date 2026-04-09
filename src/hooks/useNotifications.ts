import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import useSWR from "swr";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import { notifications as notificationsApi } from "@/lib/api";
import type { Notification, DbNotificationRow } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TranslationFn = (key: string, values?: any) => string;

/* Date helpers for useSyncExternalStore — avoids impure Date.now() in render */
function subscribeDateChange(cb: () => void) {
  // Re-check every 60s in case midnight crosses during the session
  const id = setInterval(cb, 60_000);
  return () => clearInterval(id);
}
function getToday() {
  return new Date().toDateString();
}
function getYesterday() {
  return new Date(Date.now() - 86_400_000).toDateString();
}

interface InvitationData {
  notifications: Notification[];
  pendingIds: Map<string, string>;
}

export interface UseNotificationsOptions {
  t: TranslationFn;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

/** Fetch, display, and manage notification state (invitations + DB notifications). */
export function useNotifications({
  t,
  onNavigate,
  onClose,
}: UseNotificationsOptions) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const roleLabel = useCallback(
    (role: string) => {
      if (role === "owner") return t("roleOwner");
      if (role === "admin") return t("rolePM");
      if (role === "member") return t("roleArchitect");
      return role;
    },
    [t]
  );

  // -- DB notifications (SWR with auto-polling) --
  const {
    data: dbRows = [],
    isLoading: dbLoading,
    mutate: mutateDbNotifs,
  } = useSWR<DbNotificationRow[]>("/api/notifications", {
    refreshInterval: 30000,
  });

  // -- Invitation notifications (SWR with custom fetcher) --
  // SWR pauses refreshInterval when tab is hidden and revalidates on focus
  const invitationFetcher = useCallback(async (): Promise<InvitationData> => {
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

    return { notifications: allNotifs, pendingIds: idMap };
  }, [t, roleLabel]);

  const {
    data: invData,
    isLoading: invLoading,
    mutate: mutateInvitations,
  } = useSWR<InvitationData>("invitations", invitationFetcher, {
    refreshInterval: 30000,
  });

  const invitationNotifs = useMemo(
    () => invData?.notifications ?? [],
    [invData]
  );
  const pendingInviteIds = invData?.pendingIds ?? new Map<string, string>();
  const loading = dbLoading || invLoading;

  // Listen for cross-component refresh events
  useEffect(() => {
    const handler = () => {
      mutateDbNotifs();
      mutateInvitations();
    };
    window.addEventListener("notifications-changed", handler);
    return () => window.removeEventListener("notifications-changed", handler);
  }, [mutateDbNotifs, mutateInvitations]);

  // -- Transform DB rows → Notification[] --
  const dbNotifs: Notification[] = useMemo(
    () =>
      dbRows.map((r) => ({
        id: r.id,
        type: r.type as Notification["type"],
        title: r.title,
        description:
          r.description + (r.project_name ? ` · ${r.project_name}` : ""),
        read: r.read,
        createdAt: r.created_at,
        projectId: r.project_id ?? undefined,
      })),
    [dbRows]
  );

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

  const todayStr = useSyncExternalStore(
    subscribeDateChange,
    getToday,
    getToday
  );
  const yesterdayStr = useSyncExternalStore(
    subscribeDateChange,
    getYesterday,
    getYesterday
  );

  const groups = useMemo(() => {
    return [
      {
        label: t("today"),
        items: notifications.filter(
          (n) => new Date(n.createdAt).toDateString() === todayStr
        ),
      },
      {
        label: t("yesterday"),
        items: notifications.filter(
          (n) => new Date(n.createdAt).toDateString() === yesterdayStr
        ),
      },
      {
        label: t("earlier"),
        items: notifications.filter((n) => {
          const date = new Date(n.createdAt).toDateString();
          return date !== todayStr && date !== yesterdayStr;
        }),
      },
    ].filter((g) => g.items.length > 0);
  }, [notifications, t, todayStr, yesterdayStr]);

  const handleNotificationClick = async (notification: Notification) => {
    if (
      !notification.read &&
      !notification.id.startsWith("recv-") &&
      !notification.id.startsWith("sent-")
    ) {
      await notificationsApi.markRead([notification.id]).catch(() => {});
      mutateDbNotifs(
        (prev) =>
          prev?.map((r) =>
            r.id === notification.id ? { ...r, read: true } : r
          ),
        { revalidate: false }
      );
      window.dispatchEvent(new Event("notifications-changed"));
    }
    if (notification.projectId) {
      onClose();
      onNavigate(`/projects/${notification.projectId}`);
    }
  };

  const handleMarkAllRead = async () => {
    mutateDbNotifs((prev) => prev?.map((r) => ({ ...r, read: true })), {
      revalidate: false,
    });
    mutateInvitations(
      (prev) =>
        prev
          ? {
              ...prev,
              notifications: prev.notifications.map((n) => ({
                ...n,
                read: true,
              })),
            }
          : prev,
      { revalidate: false }
    );
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
    mutateDbNotifs([], { revalidate: false });
    mutateInvitations(
      { notifications: [], pendingIds: new Map() },
      { revalidate: false }
    );
    window.dispatchEvent(new Event("notifications-changed"));
  };

  const handleDeleteOne = async (notifId: string) => {
    await notificationsApi.remove(notifId).catch(() => {});
    mutateDbNotifs((prev) => prev?.filter((r) => r.id !== notifId), {
      revalidate: false,
    });
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
    mutateInvitations(
      (prev) =>
        prev
          ? {
              notifications: prev.notifications.filter((n) => n.id !== notifId),
              pendingIds: (() => {
                const m = new Map(prev.pendingIds);
                m.delete(notifId);
                return m;
              })(),
            }
          : prev,
      { revalidate: false }
    );
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
    mutateInvitations(
      (prev) =>
        prev
          ? {
              notifications: prev.notifications.filter((n) => n.id !== notifId),
              pendingIds: (() => {
                const m = new Map(prev.pendingIds);
                m.delete(notifId);
                return m;
              })(),
            }
          : prev,
      { revalidate: false }
    );
    window.dispatchEvent(new Event("notifications-changed"));
  };

  const refresh = useCallback(() => {
    mutateDbNotifs();
    mutateInvitations();
  }, [mutateDbNotifs, mutateInvitations]);

  return {
    loading,
    notifications,
    unreadCount,
    groups,
    loadingIds,
    pendingInviteIds,
    refresh,
    handleNotificationClick,
    handleMarkAllRead,
    handleClearAll,
    handleDeleteOne,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
