"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  CircleAlert,
  Bell,
  AtSign,
  User,
  PenLine,
  Send,
  CheckCheck,
  MessageSquare,
  ListTodo,
  Inbox,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { TASK_BUCKETS, type TaskBucket } from "@/lib/validations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Bucket = TaskBucket;
export type BucketCounts = Record<TaskBucket, number>;

interface TaskBucketSidebarProps {
  activeBucket: Bucket;
  counts: BucketCounts;
  onSelect: (bucket: Bucket) => void;
  /** When "architect", hides the org-wide buckets. */
  role?: "pm" | "architect";
}

// ---------------------------------------------------------------------------
// Display tables
// ---------------------------------------------------------------------------

const BUCKET_ICONS: Record<TaskBucket, React.ElementType> = {
  important: CircleAlert,
  reminders: Bell,
  mentions: AtSign,
  tasks_for_me: User,
  tasks_by_me: PenLine,
  my_requests: Send,
  my_approvals: CheckCheck,
  my_comments: MessageSquare,
  all_tasks: ListTodo,
  all_requests: Inbox,
};

const BUCKET_LABEL_KEYS: Record<TaskBucket, string> = {
  important: "bucketImportant",
  reminders: "bucketReminders",
  mentions: "bucketMentions",
  tasks_for_me: "bucketTasksForMe",
  tasks_by_me: "bucketTasksByMe",
  my_requests: "bucketMyRequests",
  my_approvals: "bucketMyApprovals",
  my_comments: "bucketMyComments",
  all_tasks: "bucketAllTasks",
  all_requests: "bucketAllRequests",
};

interface BucketGroup {
  /** i18n key for the section header. */
  labelKey: string;
  /**
   * Buckets in render order. Use `null` to indicate a deferred bucket that's
   * still part of the type but not rendered yet.
   */
  keys: (TaskBucket | null)[];
}

/**
 * Render order for the redesigned sidebar.
 *
 * `reminders` and `mentions` live in the type union (so the icons/labels are
 * defined and ready) but are not listed here — flipping them on once
 * Phase 2/3 ships is just an inline edit.
 *
 * | Phase 2 — `reminders` | needs `task_reminder` table             |
 * | Phase 3 — `mentions`  | needs @-mention parser + `mention` table |
 */
const BUCKET_GROUPS: BucketGroup[] = [
  {
    labelKey: "groupPersonal",
    keys: [
      "important",
      // "reminders",  // TODO: Phase 2
      // "mentions",   // TODO: Phase 3
    ],
  },
  {
    labelKey: "groupTasks",
    keys: ["tasks_for_me", "tasks_by_me"],
  },
  {
    labelKey: "groupApprovals",
    keys: [
      "my_requests",
      // "my_approvals",  // TODO: Phase 4 — needs a reviewer concept on
      //                  // pin_comment (or the polymorphic Request entity)
      //                  // to count "comments waiting on my decision".
      "my_comments",
    ],
  },
  {
    labelKey: "groupAll",
    keys: ["all_tasks", "all_requests"],
  },
];

/** Buckets architects don't see — org-wide views are PM-only for now. */
const ARCHITECT_HIDDEN: ReadonlySet<TaskBucket> = new Set([
  "all_tasks",
  "all_requests",
]);

const ALL_BUCKET_KEYS_SET = new Set<TaskBucket>(TASK_BUCKETS);
function isBucketKey(value: unknown): value is TaskBucket {
  return (
    typeof value === "string" && ALL_BUCKET_KEYS_SET.has(value as TaskBucket)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Sidebar listing task buckets grouped by Personal / Tasks / Approvals / All. */
export function TaskBucketSidebar({
  activeBucket,
  counts,
  onSelect,
  role,
}: TaskBucketSidebarProps) {
  const t = useTranslations("tasks");
  const visibleGroups = useMemo(() => {
    return BUCKET_GROUPS.map((group) => ({
      ...group,
      keys: group.keys
        .filter(isBucketKey)
        .filter((k) => role !== "architect" || !ARCHITECT_HIDDEN.has(k)),
    })).filter((group) => group.keys.length > 0);
  }, [role]);

  if (!role) {
    return <SidebarSkeleton />;
  }

  return (
    <>
      {/* ── Mobile: horizontal pill bar (groups flattened) ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none lg:hidden -mx-1 px-1">
        {visibleGroups.flatMap((group) =>
          group.keys.map((key) => (
            <BucketPill
              key={key}
              bucket={key}
              label={t(BUCKET_LABEL_KEYS[key])}
              count={counts[key] ?? 0}
              isActive={activeBucket === key}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {/* ── Desktop: vertical sidebar with section headers ── */}
      <aside className="hidden lg:block w-56 shrink-0 rounded-xl bg-bg-secondary border border-border-default overflow-hidden self-start">
        <div className="flex flex-col py-2 px-2">
          {visibleGroups.map((group, gi) => (
            <div key={group.labelKey}>
              {gi > 0 && (
                <div className="my-2 mx-1 border-t border-border-default" />
              )}
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold tracking-widest text-text-muted uppercase">
                  {t(group.labelKey)}
                </span>
              </div>
              {group.keys.map((key) => (
                <BucketRow
                  key={key}
                  bucket={key}
                  label={t(BUCKET_LABEL_KEYS[key])}
                  count={counts[key] ?? 0}
                  isActive={activeBucket === key}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface RowProps {
  bucket: TaskBucket;
  label: string;
  count: number;
  isActive: boolean;
  onSelect: (bucket: TaskBucket) => void;
}

function BucketRow({ bucket, label, count, isActive, onSelect }: RowProps) {
  const Icon = BUCKET_ICONS[bucket];
  return (
    <button
      type="button"
      onClick={() => onSelect(bucket)}
      className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg border-l-[3px] text-sm transition-colors cursor-pointer ${
        isActive
          ? "bg-accent/10 text-accent font-semibold border-accent"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50 border-transparent"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      <span
        className={`text-xs tabular-nums ${isActive ? "text-accent" : "text-text-muted"}`}
      >
        {count}
      </span>
    </button>
  );
}

function BucketPill({ bucket, label, count, isActive, onSelect }: RowProps) {
  const Icon = BUCKET_ICONS[bucket];
  return (
    <button
      type="button"
      onClick={() => onSelect(bucket)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
        isActive
          ? "bg-accent/10 text-accent"
          : "text-text-secondary bg-bg-secondary hover:text-text-primary"
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
      <span
        className={`text-[10px] tabular-nums ${isActive ? "text-accent" : "text-text-muted"}`}
      >
        {count}
      </span>
    </button>
  );
}

function SidebarSkeleton() {
  return (
    <>
      <div className="flex items-center gap-2 overflow-hidden lg:hidden -mx-1 px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg shrink-0" />
        ))}
      </div>
      <aside className="hidden lg:block w-56 shrink-0 rounded-xl bg-bg-secondary border border-border-default self-start overflow-hidden">
        <div className="flex flex-col py-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <Skeleton className="w-4 h-4 rounded shrink-0" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
