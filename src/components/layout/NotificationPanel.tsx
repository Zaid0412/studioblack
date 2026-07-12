"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, UserPlus, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/formatTime";
import {
  useNotifications,
  isSyntheticNotification,
} from "@/hooks/useNotifications";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import { notificationDestination } from "@/lib/notificationDestination";
import type { Notification } from "@/types";

/**
 * Notifications get one of three icons, all in the accent colour.
 *
 * Type used to drive five hues and eight icons, so colour, icon and title all
 * encoded the same fact three times over. The icon is the only one of those
 * worth keeping, and it only needs to say whether a person is asking you
 * something or the system is telling you something. Everything else is `Bell`.
 */
const typeIcons: Record<string, typeof Bell> = {
  invitation: UserPlus,
  comment: MessageSquare,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Notification bell + dropdown panel for the header bar.
 *
 * The bell is a queue of what still needs attention, not a history: the API
 * returns only unread notifications, and clicking one is how it leaves the
 * list. Read notifications remain visible on the dashboard activity feed.
 * That's why there are no read/unread tabs and no per-item delete — every item
 * here is unread and actionable by construction.
 */
export function NotificationPanel() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const navigate = useCallback((path: string) => router.push(path), [router]);

  const {
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
  } = useNotifications({
    t,
    onNavigate: navigate,
    onClose: () => setOpen(false),
  });

  const listRef = useStaggerReveal<HTMLDivElement>(
    notifications.map((n) => n.id).join(",")
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-2 rounded-lg transition-colors cursor-pointer",
            open
              ? "text-text-primary bg-bg-secondary"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
          )}
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-text-on-accent text-[10px] font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="w-[calc(100vw-2rem)] lg:w-[420px] p-0 border-border-default bg-bg-primary rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-[52px] px-4 lg:px-5">
          <span className="text-[15px] font-semibold text-text-primary">
            {t("title")}
          </span>
          <RefreshButton onRefresh={refresh} tooltip="Refresh notifications" />
        </div>

        <div className="h-px bg-border-default" />

        {/* Body */}
        <div className="max-h-[440px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border-default bg-bg-secondary p-3"
                >
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-[34px] h-[34px] rounded-lg shrink-0" />
                    <div className="flex flex-col gap-2 flex-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Bell className="w-8 h-8 text-border-default" />
              <span className="text-sm text-text-muted">
                {t("noNotifications")}
              </span>
            </div>
          ) : (
            <div ref={listRef} className="flex flex-col gap-2 p-3 lg:p-4">
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  isInvite={pendingInviteIds.has(notification.id)}
                  isLoading={loadingIds.has(notification.id)}
                  onClick={() => handleNotificationClick(notification)}
                  onAccept={() => handleAcceptInvite(notification.id)}
                  onReject={() => handleRejectInvite(notification.id)}
                  t={t}
                />
              ))}

              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-text-muted hover:text-red-400 transition-colors pt-1 pb-1 cursor-pointer text-center"
                >
                  {t("clearAll")}
                </button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Notification card
// ---------------------------------------------------------------------------

function NotificationCard({
  notification,
  isInvite,
  isLoading,
  onClick,
  onAccept,
  onReject,
  t,
}: {
  notification: Notification;
  isInvite: boolean;
  isLoading: boolean;
  onClick: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  t: (key: string) => string;
}) {
  const Icon = typeIcons[notification.type] ?? Bell;
  const isInvitation = isInvite && notification.type === "invitation";

  // Only dress the card up as a button when the click actually does something:
  // navigate somewhere, or dismiss a real row. A received invitation does
  // neither -- its accept/decline buttons are the interaction.
  const interactive =
    notificationDestination(notification) !== null ||
    !isSyntheticNotification(notification.id);

  const buttonProps = interactive
    ? {
        onClick,
        role: "button",
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        },
      }
    : undefined;

  return (
    <div
      data-anim-item
      className={cn(
        "group rounded-xl border border-border-default transition-colors",
        interactive && "cursor-pointer hover:border-accent/60"
      )}
      {...buttonProps}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0 bg-accent/10">
            <Icon className="w-4 h-4 text-accent" />
          </div>

          {/* Content — every card here is unread, so no read/unread variants */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] leading-tight truncate font-semibold text-text-primary">
                {notification.title}
              </span>
              <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
                {relativeTime(notification.createdAt)}
              </span>
            </div>
            <span className="text-xs leading-snug line-clamp-2 mt-0.5 text-text-secondary">
              {notification.description}
            </span>
          </div>
        </div>

        {/* Invitation actions */}
        {isInvitation && (
          <div className="flex gap-2 mt-2.5">
            <Button
              size="sm"
              className="flex-1"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onAccept?.();
              }}
            >
              {isLoading ? "..." : t("accept")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onReject?.();
              }}
            >
              {t("decline")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
