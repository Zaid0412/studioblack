import { useMemo, useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { toast } from "@/components/ui/useToast";
import { authClient } from "@/lib/authClient";
import { notifications as notificationsApi } from "@/lib/api";
import { API } from "@/lib/api/routes";
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
function isSyntheticNotification(id: string): boolean {
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
  // The unread-only key, which is deliberately NOT the key /audit uses: this
  // hook optimistically drops rows from its cache as they're read, and that
  // must not reach into the audit history.
  const {
    data: dbRows = [],
    isLoading: dbLoading,
    mutate: mutateDbNotifs,
  } = useSWR<DbNotificationRow[]>(API.notificationsUnread(), {
    refreshInterval: isVisible ? POLLING_INTERVAL_MS : 0,
  });

  // -- Invitation notifications (SWR with custom fetcher) --
  // SWR pauses refreshInterval when tab is hidden and revalidates on focus
  const invitationFetcher = useCallback(async (): Promise<InvitationData> => {
    const allNotifs: Notification[] = [];
    const idMap = new Map<string, string>();

    // Independent calls -- serializing them doubles the fetcher's latency, and
    // it runs on mount, on every poll and on every focus revalidation.
    const [{ data: received }, { data: orgData }] = await Promise.all([
      authClient.organization.listUserInvitations(),
      authClient.organization.getFullOrganization(),
    ]);

    if (received) {
      for (const inv of received) {
        if (inv.status !== "pending") continue;
        const notifId = `recv-${inv.id}`;
        allNotifs.push({
          id: notifId,
          title: t("invitationReceived"),
          description: `${inv.organizationName ?? inv.organizationId} — ${roleLabel(inv.role ?? "member")}`,
          type: "invitation",
          createdAt: new Date(inv.createdAt).toISOString(),
        });
        idMap.set(notifId, inv.id);
      }
    }

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

  const handleNotificationClick = (notification: Notification) => {
    // A received invitation is acted on via its own buttons; the card body does
    // nothing. Everything else dismisses.
    if (isSyntheticNotification(notification.id)) return;

    // Close first. Dropping the row re-renders the list (and replays its
    // entrance stagger), so doing that with the panel still open reads as the
    // bell "reloading" under your cursor. Closing unconditionally -- not only
    // when there's a destination -- is what keeps that true for a notification
    // that has nowhere to go.
    onClose();
    const destination = notificationDestination(notification);
    if (destination) onNavigate(destination);

    // Reading is how a notification leaves the bell, so drop it rather than
    // flagging it -- the unread query won't return it again. On failure it
    // wasn't actually read, so put it back by revalidating.
    mutateDbNotifs((prev) => prev?.filter((r) => r.id !== notification.id), {
      revalidate: false,
    });
    void notificationsApi
      .markRead([notification.id])
      .catch(() => mutateDbNotifs());
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
    // Everything here is unread by construction: the API returns only unread
    // rows and invitations are always actionable, so the list IS the count.
    notifications,
    loadingIds,
    pendingInviteIds,
    refresh,
    handleNotificationClick,
    handleClearAll,
    handleAcceptInvite,
    handleRejectInvite,
  };
}
