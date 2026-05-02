"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  CheckSquare,
  History,
  Briefcase,
  Layers,
  FileText,
  Receipt,
  ScrollText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useFlag } from "@/hooks/useFlag";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import type { LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When set, only these roles see the tab. */
  roles?: string[];
}

/** Persistent bottom navigation bar for mobile viewports. */
export function MobileBottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { role } = useUserRole();
  const vendorManagementEnabled = useFlag("vendorManagement");
  const elementLibraryEnabled = useFlag("elementLibrary");

  const tabs = useMemo(() => {
    if (role === "vendor") {
      return [
        {
          href: "/vendor-portal",
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
          href: "/vendor-portal/invoices",
          label: t("invoices"),
          icon: Receipt,
        },
      ] satisfies Tab[];
    }

    const allTabs: Tab[] = [
      { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
      { href: "/projects", label: t("projects"), icon: FolderOpen },
      {
        href: "/tasks",
        label: t("tasks"),
        icon: CheckSquare,
        roles: ["pm", "architect"],
      },
      ...(elementLibraryEnabled
        ? [
            {
              href: "/elements/library",
              label: t("elements"),
              icon: Layers,
              roles: ["pm", "architect"],
            },
          ]
        : []),
      ...(vendorManagementEnabled
        ? [
            {
              href: "/vendors",
              label: t("vendors"),
              icon: Briefcase,
              roles: ["pm", "architect"],
            },
          ]
        : []),
      { href: "/audit", label: t("audit"), icon: History, roles: ["pm"] },
    ];
    return allTabs.filter(
      (tab) => !tab.roles || (role && tab.roles.includes(role))
    );
  }, [role, t, elementLibraryEnabled, vendorManagementEnabled]);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-bg-primary border-t border-border-default pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href + "/"));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive ? "text-accent" : "text-text-muted"
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
