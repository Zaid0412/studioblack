"use client";

import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Bell,
  Settings,
  History,
  LogOut,
  ChevronsLeft,
} from "lucide-react";
import { NavItem } from "./nav-item";
import { useSidebar } from "./sidebar-context";
import { Avatar } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { branding } from "@/config/branding";
import { features } from "@/config/features";
import { getUnreadNotificationCount } from "@/data/mock";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { User } from "@/types";

interface SidebarProps {
  variant?: "architect" | "client";
  user: User;
}

/**
 * Application sidebar with role-adaptive navigation.
 *
 * Renders different nav items depending on the `variant`:
 * - `"architect"` — full navigation including team management and audit history.
 * - `"client"` — reduced navigation scoped to client-facing features.
 *
 * Supports a collapsed (icon-only) mode toggled via `useSidebar()`.
 * Text elements fade out smoothly while the sidebar width transitions,
 * creating a seamless collapse animation. The `overflow-hidden` on the
 * aside clips content as the sidebar narrows.
 *
 * Nav items are conditionally included based on the feature flags in
 * `src/config/features.ts`.
 */
export function Sidebar({ variant = "architect", user }: SidebarProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const { isCollapsed, toggle } = useSidebar();
  const unread = getUnreadNotificationCount();

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const architectNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
    ...(features.teamManagement
      ? [{ href: "/team", label: t("team"), icon: Users }]
      : []),
    ...(features.notifications
      ? [
          {
            href: "/notifications",
            label: t("notifications"),
            icon: Bell,
            badge: unread,
          },
        ]
      : []),
    { href: "/settings", label: t("settings"), icon: Settings },
    ...(features.auditHistory
      ? [{ href: "/audit", label: t("audit"), icon: History }]
      : []),
  ];

  const clientNav = [
    {
      href: "/client-dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
    },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
    ...(features.notifications
      ? [
          {
            href: "/notifications",
            label: t("notifications"),
            icon: Bell,
            badge: unread,
          },
        ]
      : []),
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  const navItems = variant === "client" ? clientNav : architectNav;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-bg-secondary border-r border-border-default shrink-0 overflow-hidden transition-all duration-200",
        isCollapsed ? "w-16" : "w-sidebar"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 pt-6 pb-5 px-4 overflow-hidden">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.appName}
            className="h-8 w-8 rounded-md object-contain shrink-0"
          />
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent shrink-0">
            <span className="text-base font-bold text-text-on-accent">
              {branding.appName.charAt(0)}
            </span>
          </div>
        )}
        <span
          className={cn(
            "text-base font-semibold text-text-primary whitespace-nowrap transition-opacity duration-200",
            isCollapsed ? "opacity-0" : "opacity-100"
          )}
        >
          {branding.appName}
        </span>
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex flex-col gap-1 flex-1 transition-all duration-200",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Toggle button */}
      <div
        className={cn(
          "flex border-t border-border-default py-2 transition-all duration-200",
          isCollapsed ? "px-2" : "px-3"
        )}
      >
        <button
          onClick={toggle}
          className={cn(
            "flex items-center rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-all duration-200 cursor-pointer w-full overflow-hidden py-2",
            isCollapsed ? "gap-0 px-2" : "gap-2 px-4"
          )}
          aria-label={isCollapsed ? t("expandSidebar") : t("collapseSidebar")}
        >
          <ChevronsLeft
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              isCollapsed && "rotate-180"
            )}
          />
          <span
            className={cn(
              "text-xs whitespace-nowrap transition-opacity duration-200",
              isCollapsed ? "opacity-0" : "opacity-100"
            )}
          >
            {t("collapseSidebar")}
          </span>
        </button>
      </div>

      {/* User section */}
      <div
        className={cn(
          "border-t border-border-default transition-all duration-200",
          isCollapsed ? "p-2" : "p-4"
        )}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">
                  <Avatar initials={user.initials} size="sm" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-text-muted">{user.email}</span>
                </div>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                  aria-label={t("logout")}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("logout")}</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar initials={user.initials} size="sm" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-text-primary truncate">
                {user.name}
              </span>
              <span className="text-xs text-text-muted truncate">
                {user.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
              title={t("logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
