"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function NavItem({ href, label, icon: Icon, badge }: NavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors w-full",
        isActive
          ? "bg-bg-elevated text-text-primary font-semibold"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50"
      )}
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-accent")}
      />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-text-on-accent text-xs font-semibold">
          {badge}
        </span>
      )}
    </Link>
  );
}
