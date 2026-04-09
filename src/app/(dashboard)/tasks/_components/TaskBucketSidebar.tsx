"use client";

import { useMemo } from "react";
import {
  ListTodo,
  User,
  PenLine,
  Star,
  Clock,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Bucket =
  | "all"
  | "my_tasks"
  | "created_by_me"
  | "starred"
  | "upcoming"
  | "completed";

export interface BucketCounts {
  all: number;
  my_tasks: number;
  created_by_me: number;
  starred: number;
  upcoming: number;
  completed: number;
}

interface TaskBucketSidebarProps {
  activeBucket: Bucket;
  counts: BucketCounts;
  onSelect: (bucket: Bucket) => void;
  /** When "architect", hides buckets that don't apply (All, Created by Me). */
  role?: "pm" | "architect";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKETS: { key: Bucket; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All", icon: ListTodo },
  { key: "my_tasks", label: "My Tasks", icon: User },
  { key: "created_by_me", label: "Created by Me", icon: PenLine },
  { key: "starred", label: "Starred", icon: Star },
  { key: "upcoming", label: "Upcoming", icon: Clock },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Buckets hidden from architects — they only see their own tasks. */
const ARCHITECT_HIDDEN_BUCKETS: Set<Bucket> = new Set(["all", "created_by_me"]);

/** Sidebar listing task buckets (all, my tasks, starred, etc.) with counts. */
export function TaskBucketSidebar({
  activeBucket,
  counts,
  onSelect,
  role,
}: TaskBucketSidebarProps) {
  const visibleBuckets = useMemo(
    () =>
      role === "architect"
        ? BUCKETS.filter((b) => !ARCHITECT_HIDDEN_BUCKETS.has(b.key))
        : BUCKETS,
    [role]
  );

  return (
    <>
      {/* ── Mobile: horizontal pill bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none lg:hidden -mx-1 px-1">
        {visibleBuckets.map((bucket) => {
          const isActive = activeBucket === bucket.key;
          const count = counts[bucket.key] ?? 0;
          const Icon = bucket.icon;
          return (
            <button
              key={bucket.key}
              onClick={() => onSelect(bucket.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {bucket.label}
              <span
                className={`text-[10px] tabular-nums ${
                  isActive ? "text-accent" : "text-text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Desktop: vertical sidebar ── */}
      <aside className="hidden lg:block w-56 shrink-0 rounded-xl bg-bg-secondary border border-border-default overflow-hidden self-start">
        <div className="flex flex-col py-2">
          {visibleBuckets.map((bucket) => {
            const isActive = activeBucket === bucket.key;
            const count = counts[bucket.key] ?? 0;
            const Icon = bucket.icon;
            return (
              <button
                key={bucket.key}
                onClick={() => onSelect(bucket.key)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-accent/10 text-accent border-l-2 border-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50 border-l-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{bucket.label}</span>
                <span
                  className={`text-xs tabular-nums ${
                    isActive ? "text-accent" : "text-text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
