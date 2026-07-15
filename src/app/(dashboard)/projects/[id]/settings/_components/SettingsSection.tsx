"use client";

import type { LucideIcon } from "lucide-react";

/**
 * Shared chrome for a settings section — an icon badge, title + description,
 * an optional top-right action, then the section body. Gives every tab the same
 * header rhythm instead of each rolling its own.
 */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  danger,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
              danger
                ? "border-danger-border bg-danger-muted text-danger"
                : "border-border-default bg-bg-elevated text-text-secondary"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-0.5 min-w-0 pt-0.5">
            <h2 className="text-base font-semibold text-text-primary">
              {title}
            </h2>
            {description && (
              <p className="text-[13px] leading-snug text-text-muted">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/** A titled sub-block inside a section Card (e.g. "BOQ defaults"). */
export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-text-secondary">
        {label}
      </span>
      {children}
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

/** A friendly empty state for a section/card that has nothing to show. */
export function SettingsEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-default bg-bg-elevated/40 px-6 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-elevated text-text-muted">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-text-muted">{description}</p>
      )}
    </div>
  );
}
