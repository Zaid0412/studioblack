import { useMemo, useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import { notifications as notificationsApi } from "@/lib/api";
import { POLLING_INTERVAL_MS } from "@/lib/constants";
import { notificationDestination } from "@/lib/notificationDestination";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import type { Notification, DbNotificationRow } from "@/types";

// next-intl's Translator uses Record<string, any> — narrowing further breaks compatibility
type TranslationFn = (
  key: string,
  values?: Record<string, string | number | Date>
) => string;

interface InvitationData {
  notifications: Notification[];
  pendingIds: Map<string, string>;
}

/** Where org invitations are managed — the only place a `sent-` invite can lead. */
const ORG_SETTINGS_HREF = "/settings?section=organization";

/**
 * Invitation notifications are built here from the auth API rather than read
 * from the notification table, so their ids are synthetic and they have no row
 * to mark read or delete.
 */
export function isSyntheticNotification(id: string): boolean {
  return id.startsWith("recv-") || id.startsWith("sent-");
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
  const isVisible = usePageVisibility();
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
    refreshInterval: isVisible ? POLLING_INTERVAL_MS : 0,
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
        // A sent invite has no inline action, so the click has to lead somewhere.
        // A received one doesn't: accept/decline are on the card itself.
        allNotifs.push({
          id: `sent-${inv.id}`,
          title: t("invitationSent"),
          description: `${inv.email} — ${roleLabel(inv.role ?? "member")}`,
          type: "invitation",
          read: false,
          createdAt: new Date(inv.createdAt).toISOString(),
          href: ORG_SETTINGS_HREF,
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
    refreshInterval: isVisible ? POLLING_INTERVAL_MS : 0,
  });

  const invitationNotifs = useMemo(
    () => invData?.notifications ?? [],
    [invData]
  );
  const pendingInviteIds = useMemo(
    () => invData?.pendingIds ?? new Map<string, string>(),
    [invData]
  );
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
        type: r.type,
        title: r.title,
        description:
          r.description + (r.project_name ? ` · ${r.project_name}` : ""),
        read: r.read,
        createdAt: r.created_at,
        projectId: r.project_id ?? undefined,
        taskId: r.task_id ?? undefined,
        rfqId: r.rfq_id ?? undefined,
        attachmentId: r.attachment_id ?? undefined,
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

  // Everything in the list is unread by construction -- the API only returns
  // unread rows, and invitations are always actionable.
  const unreadCount = notifications.length;

  const handleNotificationClick = (notification: Notification) => {
    // Leave first. Dropping the row from the cache re-renders the list (and
    // replays its entrance stagger), so doing that before the panel closes
    // reads as the bell "reloading" under your cursor. Awaiting markRead here
    // would also hold the panel open for a network round-trip.
    const destination = notificationDestination(notification);
    if (destination) {
      onClose();
      onNavigate(destination);
    }

    if (isSyntheticNotification(notification.id)) return;

    // Reading is how a notification leaves the bell, so drop it rather than
    // flagging it -- the next fetch won't return it anyway. This settles behind
    // the closed panel. The refetch is fired only once the server has actually
    // recorded the read, or it would race and hand the row straight back.
    mutateDbNotifs((prev) => prev?.filter((r) => r.id !== notification.id), {
      revalidate: false,
    });
    void notificationsApi
      .markRead([notification.id])
      .catch(() => {})
      .finally(() => window.dispatchEvent(new Event("notifications-changed")));
  };

  /**
   * Empty the bell. Marks every notification read rather than deleting it: read
   * rows are retained for the dashboard activity feed. Invitations are left
   * alone -- they're synthetic and stay until accepted or declined.
   */
  const handleClearAll = async () => {
    if (!window.confirm(t("clearAllConfirm"))) return;
    mutateDbNotifs([], { revalidate: false });
    await notificationsApi.markAllRead().catch(() => {});
    window.dispatchEvent(new Event("notifications-changed"));
    toast({
      title: t("allCaughtUpToast"),
      description: t("allCaughtUpDescription"),
    });
  };

  /** Remove an invitation from the SWR cache and notify other components. */
  const removeInvitation = useCallback(
    (notifId: string) => {
      mutateInvitations(
        (prev) =>
          prev
            ? {
                notifications: prev.notifications.filter(
                  (n) => n.id !== notifId
                ),
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
    },
    [mutateInvitations]
  );

  const handleAcceptInvite = async (notifId: string) => {
    const invitationId = pendingInviteIds.get(notifId);
    if (!invitationId) return;
    setLoadingIds((prev) => new Set(prev).add(notifId));
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(notifId);
      return next;
    });
    if (error) {
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
    removeInvitation(notifId);
    onClose();
    onNavigate(ORG_SETTINGS_HREF);
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
    removeInvitation(notifId);
  };

  const refresh = useCallback(() => {
    mutateDbNotifs();
    mutateInvitations();
  }, [mutateDbNotifs, mutateInvitations]);

  return {
    loading,
    notifications,
    unreadCount,
    loadingIds,
    pendingInviteIds,
    refresh,
    handleNotificationClick,
    handleClearAll,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
