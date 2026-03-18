"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderOpen,
  Building2,
  Bell,
  Settings,
  History,
  LogOut,
  ChevronsLeft,
  CheckSquare,
} from "lucide-react";
import { NavItem } from "./NavItem";
import { useSidebar } from "./SidebarContext";
import { Avatar } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { branding } from "@/config/branding";
import { features } from "@/config/features";
import { authClient } from "@/lib/authClient";
import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import type { User } from "@/types";

interface SidebarProps {
  variant?: "pm" | "architect" | "client";
  user: User;
}

/**
 * Application sidebar with role-adaptive navigation.
 *
 * Renders different nav items depending on the `variant`:
 * - `"pm"` — full navigation including team management and audit history.
 * - `"architect"` — project-focused navigation without team management.
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
export function Sidebar({ variant = "pm", user }: SidebarProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const { isCollapsed, toggle } = useSidebar();

  const [unread, setUnread] = useState(0);
  const [orgName, setOrgName] = useState<string | null>(null);
  useEffect(() => {
    async function fetchOrgData() {
      let count = 0;
      // Invitations received by this user
      const { data: received } =
        await authClient.organization.listUserInvitations();
      count += received?.filter((inv) => inv.status === "pending").length ?? 0;
      // Invitations sent by org owner (pending responses) + org name
      const { data: orgData } =
        await authClient.organization.getFullOrganization();
      if (orgData) {
        setOrgName(orgData.name);
        if (orgData.invitations) {
          count += orgData.invitations.filter(
            (inv) => inv.status === "pending"
          ).length;
        }
      }
      // Add unread DB notifications count
      try {
        const res = await fetch("/api/notifications?unread=true");
        if (res.ok) {
          const { count: dbCount } = await res.json();
          count += dbCount;
        }
      } catch {
        // ignore
      }
      setUnread(count);
    }
    fetchOrgData();
    const interval = setInterval(fetchOrgData, 30000);
    const handleRefresh = () => fetchOrgData();
    window.addEventListener("notifications-changed", handleRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-changed", handleRefresh);
    };
  }, []);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  const pmNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
    { href: "/organisation", label: t("organisation"), icon: Building2 },
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

  const architectNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
    { href: "/tasks", label: t("tasks"), icon: CheckSquare },
    { href: "/organisation", label: t("organisation"), icon: Building2 },
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

  const clientNav = [
    {
      href: "/client-dashboard",
      label: t("dashboard"),
      icon: LayoutDashboard,
    },
    {
      href: "/client-dashboard/projects",
      label: t("projects"),
      icon: FolderOpen,
    },
    ...(features.notifications
      ? [
          {
            href: "/client-dashboard/notifications",
            label: t("notifications"),
            icon: Bell,
            badge: unread,
          },
        ]
      : []),
    {
      href: "/client-dashboard/settings",
      label: t("settings"),
      icon: Settings,
    },
  ];

  const navMap = { pm: pmNav, architect: architectNav, client: clientNav };
  const navItems = navMap[variant];

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-bg-secondary border-r border-border-default shrink-0 overflow-hidden transition-all duration-200",
        isCollapsed ? "w-16" : "w-sidebar"
      )}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 pt-6 pb-5 px-4 overflow-hidden"
      >
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt={branding.appName}
            className="h-8 w-8 rounded-md object-contain shrink-0 bg-logo-bg p-1"
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
      </Link>

      {/* Organisation name */}
      {orgName && (
        <div
          className={cn(
            "border-b border-border-default pb-3 mb-1 transition-all duration-200",
            isCollapsed ? "px-2" : "px-4"
          )}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/organisation"
                  className="flex items-center justify-center w-8 h-8 rounded-md bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
                >
                  <Building2 className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{orgName}</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/organisation"
              className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors group"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs font-medium truncate">{orgName}</span>
            </Link>
          )}
        </div>
      )}

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
                  <Avatar
                    initials={user.initials}
                    size="sm"
                    src={user.avatar}
                    color={avatarColor(user.id)}
                  />
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
            <Avatar
              initials={user.initials}
              size="sm"
              src={user.avatar}
              color={avatarColor(user.id)}
            />
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
