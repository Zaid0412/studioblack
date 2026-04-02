"use client";

import { useEffect } from "react";
import { X, Building2, History, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { features } from "@/config/features";
import { authClient } from "@/lib/authClient";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MobileSidebarSheetProps {
  open: boolean;
  onClose: () => void;
  variant: "pm" | "architect" | "client";
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Full-screen slide-out sidebar sheet for secondary navigation on mobile. */
export function MobileSidebarSheet({
  open,
  onClose,
  variant,
}: MobileSidebarSheetProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const secondaryNav: NavLink[] = [
    ...(variant !== "client"
      ? [{ href: "/organisation", label: t("organisation"), icon: Building2 }]
      : []),
    ...(variant === "pm" && features.auditHistory
      ? [{ href: "/audit", label: t("audit"), icon: History }]
      : []),
  ];

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 lg:hidden",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-bg-secondary border-r border-border-default flex flex-col transition-transform duration-200 ease-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={onClose}
          >
            <BrandLogo size="sm" />
            {branding.showLogoText && (
              <span className="text-sm font-semibold text-text-primary">
                {branding.appName}
              </span>
            )}
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-px bg-border-default" />

        {/* Secondary navigation */}
        <nav className="flex flex-col gap-1 flex-1 px-3 py-3">
          {secondaryNav.length > 0 && (
            <>
              <span className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                More
              </span>
              {secondaryNav.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-bg-elevated text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-[18px] h-[18px]",
                        isActive && "text-accent"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="border-t border-border-default p-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-[18px] h-[18px]" />
            {t("logout")}
          </button>
        </div>
      </div>
    </>
  );
}
