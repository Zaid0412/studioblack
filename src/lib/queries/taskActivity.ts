import { getPool } from "@/lib/db";
import type { TaskActivityEntry, TaskCommentAttachment } from "@/types";
import { logAuditSafe, AUDIT_ACTIONS, TASK_AUDIT_ACTIONS } from "./audit";

// ─── Diff & write ───────────────────────────────────────────────────────────

/** Fields on `task` that produce a timeline entry when they change. */
const TRACKED_FIELDS = [
  "status",
  "priority",
  "category",
  "assigned_to",
  "due_date",
  "project_id",
  "phase_id",
  "title",
  "description",
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

const ACTION_BY_FIELD: Record<TrackedField, string> = {
  status: AUDIT_ACTIONS.TASK_STATUS_CHANGED,
  priority: AUDIT_ACTIONS.TASK_PRIORITY_CHANGED,
  category: AUDIT_ACTIONS.TASK_CATEGORY_CHANGED,
  assigned_to: AUDIT_ACTIONS.TASK_ASSIGNEE_CHANGED,
  due_date: AUDIT_ACTIONS.TASK_DUE_DATE_CHANGED,
  project_id: AUDIT_ACTIONS.TASK_PROJECT_CHANGED,
  phase_id: AUDIT_ACTIONS.TASK_PHASE_CHANGED,
  title: AUDIT_ACTIONS.TASK_TITLE_CHANGED,
  description: AUDIT_ACTIONS.TASK_DESCRIPTION_CHANGED,
};

/**
 * Snapshot of a task at a point in time — must include the joined display
 * names (`assigned_to_name`, `project_name`, `phase_name`) so the audit
 * metadata stays self-contained even if the underlying user / project /
 * phase is later renamed or deleted.
 */
type TaskSnapshot = Record<string, unknown> & {
  assigned_to_name?: string | null;
  project_name?: string | null;
  phase_name?: string | null;
};

/** Normalize date / null comparisons across `task` snapshot variants. */
function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

/** For id-bearing fields, attach the matching display name to metadata. */
function resolveNames(
  field: string,
  before: TaskSnapshot,
  after: TaskSnapshot
): { from_name: string | null; to_name: string | null } | null {
  if (field === "assigned_to") {
    return {
      from_name: (before.assigned_to_name as string | null | undefined) ?? null,
      to_name: (after.assigned_to_name as string | null | undefined) ?? null,
    };
  }
  if (field === "project_id") {
    return {
      from_name: (before.project_name as string | null | undefined) ?? null,
      to_name: (after.project_name as string | null | undefined) ?? null,
    };
  }
  if (field === "phase_id") {
    return {
      from_name: (before.phase_name as string | null | undefined) ?? null,
      to_name: (after.phase_name as string | null | undefined) ?? null,
    };
  }
  return null;
}

/**
 * Diff old vs new task and write one audit_event per changed tracked field.
 * Description writes elide the actual content (potentially huge) — the entry
 * just records that the description was edited.
 *
 * Both snapshots must include joined display names for assignee / project /
 * phase. Names are stored alongside the IDs in metadata so the timeline rail
 * keeps reading correctly even if the underlying record is later renamed or
 * deleted.
 *
 * Failures are swallowed via logAuditSafe — audit logging must not undo the
 * mutation that already succeeded.
 */
export async function logTaskFieldChanges(input: {
  orgId: string;
  actorId: string;
  taskId: string;
  before: TaskSnapshot;
  after: TaskSnapshot;
}): Promise<void> {
  const writes: Promise<void>[] = [];
  for (const field of TRACKED_FIELDS) {
    const before = normalize(input.before[field]);
    const after = normalize(input.after[field]);
    if (before === after) continue;

    let metadata: Record<string, unknown>;
    if (field === "description") {
      metadata = {};
    } else {
      metadata = { from: before, to: after };
      const names = resolveNames(field, input.before, input.after);
      if (names) {
        metadata.from_name = names.from_name;
        metadata.to_name = names.to_name;
      }
    }

    writes.push(
      logAuditSafe({
        orgId: input.orgId,
        actorId: input.actorId,
        action: ACTION_BY_FIELD[field],
        targetTable: "task",
        targetId: input.taskId,
        metadata,
      })
    );
  }
  await Promise.all(writes);
}

// ─── Activity feed read ─────────────────────────────────────────────────────

/**
 * Fetch the merged comment + audit-event feed for a single task, ordered
 * chronologically. Audit events are filtered to the task-relevant subset
 * (`TASK_AUDIT_ACTIONS`) — vendor / rate-contract events that happen to
 * share the table never leak in.
 */
export async function getTaskActivity(
  taskId: string,
  orgId: string
): Promise<TaskActivityEntry[]> {
  const pool = getPool();
  const taskActions = Array.from(TASK_AUDIT_ACTIONS);

  const { rows } = await pool.query(
    `
    SELECT
      'comment'::text AS kind,
      tc.id::text     AS id,
      tc.author_id    AS actor_id,
      u.name          AS actor_name,
      NULL::text      AS action,
      NULL::jsonb     AS metadata,
      tc.body         AS body,
      tc.attachments  AS attachments,
      tc.updated_at   AS updated_at,
      tc.created_at   AS created_at
    FROM task_comment tc
    LEFT JOIN "user" u ON u.id = tc.author_id
    WHERE tc.task_id = $1::uuid AND tc.org_id = $2

    UNION ALL

    SELECT
      'event'::text   AS kind,
      ae.id::text     AS id,
      ae.actor_id     AS actor_id,
      u.name          AS actor_name,
      ae.action       AS action,
      ae.metadata     AS metadata,
      NULL::text      AS body,
      NULL::jsonb     AS attachments,
      NULL::timestamptz AS updated_at,
      ae.created_at   AS created_at
    FROM audit_event ae
    LEFT JOIN "user" u ON u.id = ae.actor_id
    WHERE ae.target_table = 'task'
      AND ae.target_id = $1::uuid
      AND ae.org_id = $2
      AND ae.action = ANY($3::text[])

    ORDER BY created_at ASC, id ASC
    `,
    [taskId, orgId, taskActions]
  );

  return rows.map((r): TaskActivityEntry => {
    if (r.kind === "comment") {
      return {
        kind: "comment",
        id: r.id,
        author_id: r.actor_id,
        author_name: r.actor_name ?? "Unknown",
        body: r.body,
        attachments: (r.attachments ?? []) as TaskCommentAttachment[],
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updated_at:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : (r.updated_at ?? null),
      };
    }
    return {
      kind: "event",
      id: r.id,
      actor_id: r.actor_id,
      actor_name: r.actor_name,
      action: r.action,
      metadata: r.metadata ?? null,
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    };
  });
}
