"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { Avatar } from "@/components/ui/avatar";
import { avatarColor } from "@/lib/avatarUtils";
import type { User } from "@/types";

interface MobileTopBarProps {
  user: User;
  onMenuOpen: () => void;
}

/** Top navigation bar for mobile viewports with hamburger, logo, and avatar. */
export function MobileTopBar({ user, onMenuOpen }: MobileTopBarProps) {
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
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandLogo size="sm" />
          {branding.showLogoText && (
            <span className="text-sm font-semibold text-text-primary">
              {branding.appName}
            </span>
          )}
        </Link>
      </div>

      {/* Right: notifications + avatar */}
      <div className="flex items-center gap-2">
        <NotificationPanel />
        <Link href="/settings" className="shrink-0">
          <Avatar
            initials={user.initials}
            size="sm"
            src={user.avatar}
            color={avatarColor(user.id)}
          />
        </Link>
      </div>
    </header>
  );
}
