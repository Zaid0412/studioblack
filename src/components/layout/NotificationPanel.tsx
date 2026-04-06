"use client";

import { useState } from "react";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/formatTime";
import { useNotifications } from "@/hooks/useNotifications";

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
  invitation: "text-accent",
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

  const {
    loading,
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
  } = useNotifications({
    t,
    onNavigate: (path) => router.push(path),
    onClose: () => setOpen(false),
  });

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
        className="w-[calc(100vw-2rem)] lg:w-[400px] p-0 border-border-default bg-bg-primary rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-[52px] px-4 lg:px-5 border-b border-border-default">
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-secondary text-text-muted hover:text-text-secondary transition-colors text-xs cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t("markAllRead")}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-secondary text-text-muted hover:text-red-400 transition-colors text-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("clearAll")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[440px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Bell className="w-8 h-8 text-border-default" />
              <span className="text-sm text-text-muted">
                {t("noNotifications")}
              </span>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center h-9 px-4 lg:px-5">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                {group.items.map((notification, idx) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  const iconColor =
                    typeColors[notification.type] || "text-text-muted";
                  const isUnread = !notification.read;
                  return (
                    <div key={notification.id}>
                      {idx > 0 && (
                        <div className="h-px bg-border-default mx-4 lg:mx-5" />
                      )}
                      <div
                        className={cn(
                          "flex items-start gap-3 px-4 lg:px-5 py-3 cursor-pointer hover:bg-bg-elevated/50 transition-colors",
                          isUnread && "bg-bg-secondary/50"
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
                          <div className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />
                        )}
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <span
                            className={cn(
                              "text-[13px] leading-tight",
                              isUnread
                                ? "font-medium text-text-primary"
                                : "text-text-secondary"
                            )}
                          >
                            {notification.title}
                          </span>
                          <span
                            className={cn(
                              "text-xs leading-snug line-clamp-2",
                              isUnread
                                ? "text-text-secondary"
                                : "text-text-muted"
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
                          <span className="text-[11px] text-text-muted">
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
                                className="p-0.5 rounded text-text-muted hover:text-red-400 transition-colors cursor-pointer"
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
