"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  ListTodo,
  User,
  PenLine,
  Star,
  Clock,
  CheckCircle2,
  Loader2,
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

const BUCKET_ICONS: Record<Bucket, React.ElementType> = {
  all: ListTodo,
  my_tasks: User,
  created_by_me: PenLine,
  starred: Star,
  upcoming: Clock,
  completed: CheckCircle2,
};

const BUCKET_KEYS: Bucket[] = [
  "all",
  "my_tasks",
  "created_by_me",
  "starred",
  "upcoming",
  "completed",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Buckets hidden from architects — they only see their own tasks. */
const ARCHITECT_HIDDEN_BUCKETS: Set<Bucket> = new Set(["all", "created_by_me"]);

const BUCKET_LABEL_KEYS: Record<Bucket, string> = {
  all: "bucketAll",
  my_tasks: "bucketMyTasks",
  created_by_me: "bucketCreatedByMe",
  starred: "bucketStarred",
  upcoming: "bucketUpcoming",
  completed: "bucketCompleted",
};

/** Sidebar listing task buckets (all, my tasks, starred, etc.) with counts. */
export function TaskBucketSidebar({
  activeBucket,
  counts,
  onSelect,
  role,
}: TaskBucketSidebarProps) {
  const t = useTranslations("tasks");
  const visibleBuckets = useMemo(
    () =>
      role === "architect"
        ? BUCKET_KEYS.filter((k) => !ARCHITECT_HIDDEN_BUCKETS.has(k))
        : BUCKET_KEYS,
    [role]
  );

  if (!role) {
    return (
      <>
        {/* Mobile placeholder */}
        <div className="flex items-center justify-center h-10 lg:hidden">
          <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
        </div>
        {/* Desktop placeholder */}
        <aside className="hidden lg:flex items-center justify-center w-56 shrink-0 rounded-xl bg-bg-secondary border border-border-default self-start min-h-[200px]">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </aside>
      </>
    );
  }

  return (
    <>
      {/* ── Mobile: horizontal pill bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none lg:hidden -mx-1 px-1">
        {visibleBuckets.map((key) => {
          const isActive = activeBucket === key;
          const count = counts[key] ?? 0;
          const Icon = BUCKET_ICONS[key];
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isActive
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary bg-bg-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {t(BUCKET_LABEL_KEYS[key])}
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
          {visibleBuckets.map((key) => {
            const isActive = activeBucket === key;
            const count = counts[key] ?? 0;
            const Icon = BUCKET_ICONS[key];
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-accent/10 text-accent border-l-2 border-accent font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50 border-l-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{t(BUCKET_LABEL_KEYS[key])}</span>
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
