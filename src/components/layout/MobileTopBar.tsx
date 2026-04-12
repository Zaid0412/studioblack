"use client";

import { Menu, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { AvatarMenu } from "@/components/layout/AvatarMenu";
import { useTheme } from "@/components/ThemeProvider";
import type { User } from "@/types";

interface MobileTopBarProps {
  user: User;
  onMenuOpen: () => void;
}

/** Top navigation bar for mobile viewports with hamburger, logo, and avatar. */
export function MobileTopBar({ user, onMenuOpen }: MobileTopBarProps) {
  const { mode, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-bg-primary border-b border-border-default lg:hidden">
      {/* Left: hamburger + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="p-1.5 -ml-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 -ml-2">
          <BrandLogo size="md" />
          {branding.showLogoText && (
            <span className="text-sm font-semibold text-text-primary">
              {branding.appName}
            </span>
          )}
        </Link>
      </div>

      {/* Right: theme toggle + notifications + avatar menu */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated/50 transition-colors cursor-pointer"
          aria-label={
            mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {mode === "dark" ? (
            <Sun className="w-4.5 h-4.5" />
          ) : (
            <Moon className="w-4.5 h-4.5" />
          )}
        </button>
        <NotificationPanel />
        <AvatarMenu user={user} />
      </div>
    </header>
  );
}
