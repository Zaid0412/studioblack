"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface AuthCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Content rendered in the header area, below the description */
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      {/* Top bar — logo left, theme toggle right */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle className="relative" />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-[440px]">
        <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
          {/* Top section — icon, title, description */}
          <div className="flex flex-col items-center gap-5 px-8 pt-10 pb-7 bg-gradient-to-b from-accent/10 to-transparent">
            <div className="w-12 h-12 rounded-[14px] bg-accent/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-accent" />
            </div>
            <div className="text-center">
              <h1 className="text-[22px] font-bold text-text-primary">
                {title}
              </h1>
              <p className="text-sm text-text-muted mt-1.5">{description}</p>
            </div>
            {headerExtra}
          </div>

          {/* Divider */}
          <div className="h-px bg-border-default" />

          {/* Bottom section */}
          <div className="px-8 pt-6 pb-8">{children}</div>
        </div>

        {/* Back to home */}
        <p className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            &larr; Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
