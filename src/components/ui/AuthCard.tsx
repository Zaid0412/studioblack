"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface AuthCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Content rendered in the gradient header area, below the description */
  headerExtra?: ReactNode;
  /** Content rendered below the divider */
  children: ReactNode;
}

/** Centered card layout for standalone auth pages (verify email, confirm change, etc.) */
export function AuthCard({
  icon: Icon,
  title,
  description,
  headerExtra,
  children,
}: AuthCardProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-primary px-6">
      <ThemeToggle />

      <div className="w-full max-w-[440px] rounded-2xl border border-border-default bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)] dark:bg-bg-secondary dark:shadow-lg overflow-hidden">
        {/* Top section — icon, title, description */}
        <div className="flex flex-col items-center gap-5 px-8 pt-10 pb-7 bg-gradient-to-b from-accent/40 dark:from-accent/5 to-transparent">
          <div className="w-12 h-12 rounded-[14px] bg-accent/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-accent" />
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-bold text-text-primary">{title}</h1>
            <p className="text-sm text-text-muted mt-1.5">{description}</p>
          </div>
          {headerExtra}
        </div>

        {/* Divider */}
        <div className="h-px bg-border-default" />

        {/* Bottom section */}
        <div className="px-8 pt-6 pb-8">{children}</div>
      </div>
    </div>
  );
}
