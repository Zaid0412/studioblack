"use client";

import { useMemo, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { UserPlus, Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/use-toast";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

const typeIcons: Record<string, typeof Bell> = {
  invitation: UserPlus,
};

const typeColors: Record<string, string> = {
  invitation: "bg-accent/10 text-accent",
};

/** Notifications feed grouped by date. */
export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const te = useTranslations("emptyStates");

  const router = useRouter();
  const [invitationNotifs, setInvitationNotifs] = useState<Notification[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  // Track real invitation IDs for accept/reject (maps notification.id → invitationId)
  const [pendingInviteIds, setPendingInviteIds] = useState<Map<string, string>>(
    new Map()
  );

  const roleLabel = (role: string) => {
    if (role === "owner") return t("roleOwner");
    if (role === "admin") return t("rolePM");
    if (role === "member") return t("roleArchitect");
    return role;
  };

  // Fetch invitations — both sent (org owner) and received (invited user)
  useEffect(() => {
    async function loadInvitations() {
      const allNotifs: Notification[] = [];
      const idMap = new Map<string, string>();

      // 1. Invitations received by this user (pending acceptance)
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

      // 2. Invitations sent by org owner
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
    }
    loadInvitations();
    const interval = setInterval(loadInvitations, 10000);
    return () => clearInterval(interval);
  }, [t]);

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

  const notifications: Notification[] = useMemo(
    () =>
      [...invitationNotifs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [invitationNotifs]
  );

  // Group by date
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setInvitationNotifs((prev) =>
                prev.map((n) => ({ ...n, read: true }))
              );
              toast({
                title: t("allCaughtUpToast"),
                description: t("allCaughtUpDescription"),
              });
            }}
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
