"use client";

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

/** Sidebar listing task buckets (all, my tasks, starred, etc.) with counts. */
export function TaskBucketSidebar({
  activeBucket,
  counts,
  onSelect,
}: TaskBucketSidebarProps) {
  return (
    <>
      {/* ── Mobile: horizontal pill bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none lg:hidden -mx-1 px-1">
        {BUCKETS.map((bucket) => {
          const isActive = activeBucket === bucket.key;
          const count = counts[bucket.key] ?? 0;
          const Icon = bucket.icon;
          return (
            <button
              key={bucket.key}
              onClick={() => onSelect(bucket.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#F5C518]/10 text-[#F5C518]"
                  : "text-[#A0A0A0] bg-[#1A1A1A] hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {bucket.label}
              <span
                className={`text-[10px] tabular-nums ${
                  isActive ? "text-[#F5C518]" : "text-[#666666]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Desktop: vertical sidebar ── */}
      <aside className="hidden lg:block w-56 shrink-0 rounded-xl bg-[#1A1A1A] border border-[#333333] overflow-hidden self-start">
        <div className="flex flex-col py-2">
          {BUCKETS.map((bucket) => {
            const isActive = activeBucket === bucket.key;
            const count = counts[bucket.key] ?? 0;
            const Icon = bucket.icon;
            return (
              <button
                key={bucket.key}
                onClick={() => onSelect(bucket.key)}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#F5C518]/10 text-[#F5C518] border-l-2 border-[#F5C518] font-semibold"
                    : "text-[#A0A0A0] hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{bucket.label}</span>
                <span
                  className={`text-xs tabular-nums ${
                    isActive ? "text-[#F5C518]" : "text-[#666666]"
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
