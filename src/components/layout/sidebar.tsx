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
} from "lucide-react";
import { NavItem } from "./nav-item";
import { Avatar } from "@/components/ui/avatar";
import { branding } from "@/config/branding";
import { features } from "@/config/features";
import { currentUser, getUnreadNotificationCount } from "@/data/mock";

interface SidebarProps {
  variant?: "architect" | "client";
}

/**
 * Application sidebar with role-adaptive navigation.
 *
 * Renders different nav items depending on the `variant`:
 * - `"architect"` — full navigation including team management and audit history.
 * - `"client"` — reduced navigation scoped to client-facing features.
 *
 * Nav items are conditionally included based on the feature flags in
 * `src/config/features.ts`.
 */
export function Sidebar({ variant = "architect" }: SidebarProps) {
  const t = useTranslations("nav");
  const unread = getUnreadNotificationCount();

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
    <aside className="flex flex-col h-screen w-sidebar bg-bg-secondary border-r border-border-default shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 pt-6 pb-5">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.appName}
            className="h-8 w-8 rounded-md object-contain"
          />
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent">
            <span className="text-base font-bold text-text-on-accent">
              {branding.appName.charAt(0)}
            </span>
          </div>
        )}
        <span className="text-base font-semibold text-text-primary">
          {branding.appName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 flex-1">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-border-default p-4">
        <div className="flex items-center gap-3">
          <Avatar initials={currentUser.initials} size="sm" />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-text-primary truncate">
              {currentUser.name}
            </span>
            <span className="text-xs text-text-muted truncate">
              {currentUser.email}
            </span>
          </div>
          <button
            className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
            title={t("logout")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
