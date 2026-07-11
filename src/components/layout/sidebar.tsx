"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FolderOpen,
  Building2,
  Settings,
  History,
  LogOut,
  ChevronsLeft,
  ChevronUp,
  CheckSquare,
  Layers,
  FolderTree,
  Briefcase,
  FileText,
  Receipt,
  ScrollText,
  TrendingUp,
  UserCog,
  Sun,
  Moon,
} from "lucide-react";
import { NavItem } from "./NavItem";
import { useSidebar } from "./SidebarContext";
import { Avatar } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { branding } from "@/config/branding";
import { useTheme } from "@/components/ThemeProvider";
import { features } from "@/config/features";
import { useFlag } from "@/hooks/useFlag";
import { signOutAndReset } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import type { User } from "@/types";

interface SidebarProps {
  variant?: "pm" | "architect" | "client" | "vendor";
  user: User;
  orgName?: string | null;
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
export function Sidebar({
  variant = "pm",
  user,
  orgName = null,
}: SidebarProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  const { isCollapsed, toggle } = useSidebar();
  const { mode, toggleTheme } = useTheme();
  const logoSrc =
    mode === "dark"
      ? branding.logoUrl
      : (branding.logoUrlDark ?? branding.logoUrl);

  const handleLogout = async () => {
    await signOutAndReset();
    router.push("/login");
  };

  // Feature flags resolve on the client (PostHog), so gate flag-dependent nav
  // items on `mounted`: render identically on the server and the first client
  // paint (items hidden), then reveal post-mount. Avoids a hydration mismatch
  // when a flag is on for this user.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount flag to gate client-only feature flags
  useEffect(() => setMounted(true), []);
  const elementLibraryEnabled = useFlag("elementLibrary") && mounted;
  const vendorManagementEnabled = useFlag("vendorManagement") && mounted;

  // Shared members of the PM/architect nav. Clients get a shorter trimmed list.
  const memberNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
    { href: "/tasks", label: t("tasks"), icon: CheckSquare },
    ...(elementLibraryEnabled
      ? [
          {
            href: "/elements/library",
            activeHref: "/elements",
            label: t("elements"),
            icon: Layers,
          },
        ]
      : []),
    ...(vendorManagementEnabled
      ? [{ href: "/vendors", label: t("vendors"), icon: Briefcase }]
      : []),
    ...(elementLibraryEnabled
      ? [{ href: "/categories", label: t("categories"), icon: FolderTree }]
      : []),
  ];

  const pmNav = [
    ...memberNav,
    ...(features.auditHistory
      ? [{ href: "/audit", label: t("audit"), icon: History }]
      : []),
  ];

  const clientNav = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("projects"), icon: FolderOpen },
  ];

  const vendorNav = [
    {
      href: "/dashboard",
      label: t("vendorDashboard"),
      icon: LayoutDashboard,
    },
    { href: "/vendor-portal/rfqs", label: t("rfqs"), icon: FileText },
    {
      href: "/vendor-portal/purchase-orders",
      label: t("purchaseOrders"),
      icon: ScrollText,
    },
    {
      href: "/vendor-portal/progress",
      label: t("progress"),
      icon: TrendingUp,
    },
    { href: "/vendor-portal/invoices", label: t("invoices"), icon: Receipt },
    { href: "/vendor-portal/profile", label: t("profile"), icon: UserCog },
    { href: "/tasks", label: t("tasks"), icon: CheckSquare },
  ];

  const navMap = {
    pm: pmNav,
    architect: memberNav,
    client: clientNav,
    vendor: vendorNav,
  };
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
        className={cn(
          "flex overflow-hidden transition-all duration-200 ease-out",
          isCollapsed ? "px-2" : "px-4",
          branding.showLogoText
            ? "items-center gap-2.5 pt-6 pb-5"
            : "justify-center py-0"
        )}
      >
        {logoSrc ? (
          <Image
            src={logoSrc}
            alt={branding.appName}
            width={96}
            height={96}
            className={cn(
              "object-contain transition-all duration-200 ease-out",
              branding.showLogoText
                ? "h-8 w-8 rounded-md bg-logo-bg p-1 shrink-0"
                : isCollapsed
                  ? "h-14 w-14"
                  : "h-24 w-24"
            )}
          />
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent shrink-0">
            <span className="text-base font-bold text-text-on-accent">
              {branding.appName.charAt(0)}
            </span>
          </div>
        )}
        {branding.showLogoText && (
          <span
            className={cn(
              "text-base font-semibold text-text-primary whitespace-nowrap transition-opacity duration-200",
              isCollapsed ? "opacity-0" : "opacity-100"
            )}
          >
            {branding.appName}
          </span>
        )}
      </Link>

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
            isCollapsed ? "justify-center gap-0 px-2" : "gap-2 px-4"
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
              isCollapsed ? "hidden" : "opacity-100"
            )}
          >
            {t("collapseSidebar")}
          </span>
        </button>
      </div>

      {/* Settings + user menu */}
      <div
        className={cn(
          "flex flex-col gap-1 border-t border-border-default transition-all duration-200",
          isCollapsed ? "p-2" : "px-3 py-2"
        )}
      >
        <NavItem
          href="/settings"
          label={t("settings")}
          icon={Settings}
          isCollapsed={isCollapsed}
        />
        <div className="border-t border-border-default my-1" />
        <Popover>
          <PopoverTrigger asChild>
            {isCollapsed ? (
              <button className="flex items-center justify-center w-full cursor-pointer rounded-lg p-1 hover:bg-bg-elevated/50 transition-colors">
                <Avatar
                  initials={user.initials}
                  size="sm"
                  src={user.avatar}
                  color={avatarColor(user.id)}
                />
              </button>
            ) : (
              <button className="group flex items-center gap-2.5 w-full cursor-pointer rounded-lg px-2 py-1.5 hover:bg-bg-elevated/50 transition-colors overflow-hidden">
                <Avatar
                  initials={user.initials}
                  size="sm"
                  src={user.avatar}
                  color={avatarColor(user.id)}
                />
                <div className="flex flex-col min-w-0 flex-1 text-left">
                  <span className="text-xs font-medium text-text-primary truncate">
                    {user.name}
                  </span>
                  <span className="text-[10px] text-text-muted truncate">
                    {user.email}
                  </span>
                </div>
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-56 p-1.5">
            {orgName && variant !== "client" && variant !== "vendor" && (
              <>
                <Link
                  href="/settings?section=organization"
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-text-primary hover:bg-bg-elevated transition-colors text-[13px] font-medium"
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{orgName}</span>
                </Link>
                <div className="border-t border-border-default my-1" />
              </>
            )}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-between px-2.5 py-2 rounded-md text-text-primary hover:bg-bg-elevated transition-colors text-[13px] font-medium w-full cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                {mode === "dark" ? (
                  <Moon className="h-4 w-4 shrink-0" />
                ) : (
                  <Sun className="h-4 w-4 shrink-0" />
                )}
                {mode === "dark" ? "Dark Mode" : "Light Mode"}
              </span>
              <span className="text-[10px] text-text-muted">
                {mode === "dark" ? "Switch to light" : "Switch to dark"}
              </span>
            </button>
            <div className="border-t border-border-default my-1" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-red-400 font-medium hover:bg-red-400/10 transition-colors text-[13px] w-full cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}
