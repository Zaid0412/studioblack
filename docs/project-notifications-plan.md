# Per-project notification preferences — design (deferred)

Status: **design only, not built.** Split out of the "Expand project Settings" work
because it's larger and riskier than the other settings (net-new schema, a second
delivery channel to gate, and a placement question the PM-only settings page
doesn't cleanly answer). This doc is the plan for its own PR.

## Goal

Let notifications for a project be silenced. "Mute a project" — no bell, no email
for that project's activity — without losing the audit trail.

Out of scope for v1: **digests** (batching/scheduling is a separate feature) and
notifications with no project (`project_id` is nullable — standalone tasks, vendor
RFQ replies).

## The placement decision (must resolve first)

"Mute a project" is naturally **per-user** — each member decides what they want to
hear about. But the project Settings page is **PM-only** (only project PMs reach
it). Two coherent options:

- **A — per-user mute, in the user's global settings.** Add a "Muted projects"
  panel to `src/app/(dashboard)/settings/` (the global settings page), listing the
  user's projects with a toggle. Every member can self-serve. Recommended — it
  matches how mute is understood and doesn't overload the PM page.
- **B — PM-level project mute, on the project Settings page.** A PM silences the
  project's notifications for the whole team. Fits the existing page, but it's a
  blunt instrument (one person mutes everyone) and is really a different feature.

This doc assumes **A** (per-user). If B is chosen, the table key changes from
`(user_id, project_id)` to just `project_id` and the gating reads a project flag.

## Model

```sql
CREATE TABLE IF NOT EXISTS project_notification_mute (
  user_id    TEXT NOT NULL REFERENCES "user"(id)  ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES project(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);
```

**Suppress at create**, not hide on read: read paths (`getNotifications`,
`getRecentActivity`) deliberately keep already-read rows for `/audit` history, and
hiding on read would still fire the emails. Muting must stop the write.

## In-app gating (centralized — the easy half)

Every in-app notification is created through **`src/lib/notifications.ts`**:

- `createNotification` (single row) — add a guard: skip if a mute row exists for
  `(user_id, project_id)`.
- `createNotificationsForTeam` (INSERT-SELECT fan-out) — add
  `AND NOT EXISTS (SELECT 1 FROM project_notification_mute m WHERE m.user_id = <recipient> AND m.project_id = <project>)`.
- `createNotificationForClient` (INSERT-SELECT) — same join.
- `notifyPmAssignment` loops per user — guard inside the loop.

~3–4 functions, one file. Notifications with a null `project_id` are simply never
muted (nothing to key on) — acceptable.

## ⚠️ Email gating (the hard half — do not forget)

Email is a **separate path** that does NOT go through `createNotification`. A mute
that only guards in-app leaves the emails flowing. The email helpers to gate too:

- `notifyUserByEmail` / `notifyUserByEmailWithContext` (`src/lib/notifications.ts`)
- `notifyTeamByEmail` (`src/lib/notifications.ts`)
- the direct `sendNotificationEmail` in
  `src/app/api/projects/[id]/boq/_phaseNotifications.ts` (~line 226)

Each needs the same `(user_id, project_id)` mute check before sending. This roughly
doubles the surface — it's the main reason this is its own PR.

## Emit call sites (for coverage — all should honor the mute)

16 route files funnel through the helpers above. Reference list:

| Trigger                                          | File                                                  |
| ------------------------------------------------ | ----------------------------------------------------- |
| Project create/update → PM assigned              | `api/projects/route.ts`, `api/projects/[id]/route.ts` |
| File uploaded / review decision / send-to-client | `api/projects/[id]/attachments/**`                    |
| Pin comment / assignment                         | `.../attachments/[attachmentId]/pins/route.ts`        |
| New comment                                      | `api/projects/[id]/comments/route.ts`                 |
| Client approval decision                         | `api/projects/[id]/approvals/route.ts`                |
| Phase-task assigned / reviewed / request-review  | `api/projects/[id]/tasks/**`                          |
| BOQ lifecycle phase change                       | `api/projects/[id]/boq/_phaseNotifications.ts`        |
| Standalone task assigned/reassigned\*            | `api/tasks/**`                                        |
| Vendor quote submitted / declined\*              | `api/vendor-portal/rfqs/**`                           |

\* nullable/absent `project_id` → out of scope for muting.

## UI

- **Option A:** a "Muted projects" section in the global settings page
  (`?section=notifications` or similar), listing the user's projects with a
  `ToggleSwitch`; toggle → `POST/DELETE /api/notifications/mutes/[projectId]`.
- New API: list the user's mutes + set/unset one. `useNotifications` needs no
  change (mute suppresses at source).

## Verification (when built)

- Mute a project → no new bell rows AND no emails for that project's activity;
  other projects unaffected; existing/read notifications untouched (audit intact).
- Unmute → notifications resume.
- Tests: a muted `(user, project)` short-circuits each of the 3 in-app helpers and
  the email helpers; null-project notifications ignore the mute.
