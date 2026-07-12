"use client";

import { useState, useMemo, useCallback } from "react";
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
  X,
} from "lucide-react";
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
import { useNotifications } from "@/hooks/useNotifications";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { Notification } from "@/types";

// ---------------------------------------------------------------------------
// Type → icon mapping
// ---------------------------------------------------------------------------
const typeIcons: Record<string, typeof Bell> = {
  invitation: UserPlus,
  comment: MessageSquare,
  upload: Upload,
  approval: CheckCircle2,
  review_requested: ClipboardCheck,
  review_submitted: AlertTriangle,
  task_assigned: ListChecks,
};

// ---------------------------------------------------------------------------
// Type → accent color mapping (border + icon bg + icon fill)
// ---------------------------------------------------------------------------
const typeAccent: Record<string, { border: string; bg: string; fill: string }> =
  {
    invitation: {
      border: "border-l-amber-400",
      bg: "bg-amber-400/10",
      fill: "text-amber-400",
    },
    review_requested: {
      border: "border-l-amber-400",
      bg: "bg-amber-400/10",
      fill: "text-amber-400",
    },
    comment: {
      border: "border-l-blue-400",
      bg: "bg-blue-400/10",
      fill: "text-blue-400",
    },
    upload: {
      border: "border-l-green-400",
      bg: "bg-green-400/10",
      fill: "text-green-400",
    },
    approval: {
      border: "border-l-green-400",
      bg: "bg-green-400/10",
      fill: "text-green-400",
    },
    review_submitted: {
      border: "border-l-purple-400",
      bg: "bg-purple-400/10",
      fill: "text-purple-400",
    },
    task_assigned: {
      border: "border-l-indigo-400",
      bg: "bg-indigo-400/10",
      fill: "text-indigo-400",
    },
  };

const defaultAccent = {
  border: "border-l-zinc-500",
  bg: "bg-zinc-500/10",
  fill: "text-zinc-500",
};

type Tab = "all" | "unread" | "invitations";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Notification bell + dropdown panel for the header bar. */
export function NotificationPanel() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const navigate = useCallback((path: string) => router.push(path), [router]);

  const {
    loading,
    notifications,
    unreadCount,
    loadingIds,
    pendingInviteIds,
    refresh,
    handleNotificationClick,
    handleMarkAllRead,
    handleClearAll,
    handleDeleteOne,
    handleAcceptInvite,
    handleRejectInvite,
  } = useNotifications({
    t,
    onNavigate: navigate,
    onClose: () => setOpen(false),
  });

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "unread":
        return notifications.filter((n) => !n.read);
      case "invitations":
        return notifications.filter((n) => n.type === "invitation");
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const invitationCount = useMemo(
    () => notifications.filter((n) => n.type === "invitation").length,
    [notifications]
  );

  const listRef = useStaggerReveal<HTMLDivElement>(
    filtered.map((n) => n.id).join(",")
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
          <div className="flex items-center gap-1.5">
            <RefreshButton
              onRefresh={refresh}
              tooltip="Refresh notifications"
            />
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-secondary text-text-muted hover:text-text-secondary transition-colors text-xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t("markAllRead")}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 lg:px-5 gap-0" role="tablist">
          <TabButton
            id="notif-tab-all"
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            label={t("all") || "All"}
          />
          <TabButton
            id="notif-tab-unread"
            active={activeTab === "unread"}
            onClick={() => setActiveTab("unread")}
            label={t("unread") || "Unread"}
            count={unreadCount}
          />
          <TabButton
            id="notif-tab-invitations"
            active={activeTab === "invitations"}
            onClick={() => setActiveTab("invitations")}
            label={t("invitations") || "Invitations"}
            count={invitationCount || undefined}
          />
        </div>

        <div className="h-px bg-border-default" />

        {/* Body */}
        <div
          className="max-h-[440px] overflow-y-auto"
          role="tabpanel"
          aria-labelledby={`notif-tab-${activeTab}`}
        >
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Bell className="w-8 h-8 text-border-default" />
              <span className="text-sm text-text-muted">
                {activeTab === "unread"
                  ? t("noUnread") || t("noNotifications")
                  : activeTab === "invitations"
                    ? t("noInvitations") || t("noNotifications")
                    : t("noNotifications")}
              </span>
            </div>
          ) : (
            <div ref={listRef} className="flex flex-col gap-2 p-3 lg:p-4">
              {filtered.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  isInvite={pendingInviteIds.has(notification.id)}
                  isLoading={loadingIds.has(notification.id)}
                  onClick={() => handleNotificationClick(notification)}
                  onDelete={
                    !notification.id.startsWith("recv-") &&
                    !notification.id.startsWith("sent-")
                      ? () => handleDeleteOne(notification.id)
                      : undefined
                  }
                  onAccept={() => handleAcceptInvite(notification.id)}
                  onReject={() => handleRejectInvite(notification.id)}
                  t={t}
                />
              ))}

              {/* Clear all — only show on "all" tab with items */}
              {activeTab === "all" && filtered.length > 0 && (
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
// Tab button (underline-style)
// ---------------------------------------------------------------------------

function TabButton({
  id,
  active,
  onClick,
  label,
  count,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors cursor-pointer border-b-2",
        active
          ? "text-text-primary border-accent"
          : "text-text-muted border-transparent hover:text-text-secondary"
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full text-[10px] font-bold",
            active
              ? "bg-accent text-text-on-accent"
              : "bg-bg-elevated text-text-muted"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
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
  onDelete,
  onAccept,
  onReject,
  t,
}: {
  notification: Notification;
  isInvite: boolean;
  isLoading: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  t: (key: string) => string;
}) {
  const isUnread = !notification.read;
  const accent = typeAccent[notification.type] ?? defaultAccent;
  const Icon = typeIcons[notification.type] ?? Bell;
  const isInvitation = isInvite && notification.type === "invitation";

  return (
    <div
      data-anim-item
      className={cn(
        "group rounded-xl border border-border-default border-l-[3px] transition-colors cursor-pointer",
        accent.border,
        isInvitation && "border-accent/30",
        !isUnread && "opacity-60"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              "w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0",
              accent.bg
            )}
          >
            <Icon className={cn("w-4 h-4", accent.fill)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[13px] leading-tight truncate",
                  isUnread
                    ? "font-semibold text-text-primary"
                    : "font-normal text-text-secondary"
                )}
              >
                {notification.title}
              </span>
              <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
                {relativeTime(notification.createdAt)}
              </span>
            </div>
            <span
              className={cn(
                "text-xs leading-snug line-clamp-2 mt-0.5",
                isUnread ? "text-text-secondary" : "text-text-muted"
              )}
            >
              {notification.description}
            </span>
          </div>

          {/* Delete (visible on hover, always visible on touch) */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="max-lg:opacity-100 opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer shrink-0"
              aria-label="Delete notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
