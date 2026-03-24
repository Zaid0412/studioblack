/**
 * Central route map — single source of truth for all API URLs.
 *
 * STRUCTURE
 * ─────────────────────────────────────────────────
 * projects         /api/projects
 *   ├─ attachments   /api/projects/:id/attachments
 *   ├─ versions      /api/projects/:id/versions
 *   ├─ comments      /api/projects/:id/comments
 *   ├─ approvals     /api/projects/:id/approvals
 *   └─ tasks review  /api/projects/:id/tasks/:taskId/review
 *
 * tasks            /api/tasks
 *   ├─ checklist     /api/tasks/:id/checklist
 *   └─ attachments   /api/tasks/:id/attachments
 *
 * notifications    /api/notifications
 * upload           /api/upload, /api/avatar, /api/proxy-file
 * dashboard        /api/dashboard
 * client           /api/client/projects
 * ─────────────────────────────────────────────────
 */
export const API = {
  // ── Projects ────────────────────────────────────
  projects:              ()                            => "/api/projects",
  project:               (id: string)                  => `/api/projects/${id}`,

  // ── Project → Attachments ──────────────────────
  attachments:           (pid: string)                 => `/api/projects/${pid}/attachments`,
  attachment:            (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}`,
  attachmentReview:      (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}/review`,
  attachmentFreeze:      (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}/freeze`,
  attachmentUnfreeze:    (pid: string, fid: string)    => `/api/projects/${pid}/attachments/${fid}/unfreeze`,

  // ── Project → Versions ─────────────────────────
  versionHistory:        (pid: string, group: string)  => `/api/projects/${pid}/versions/${group}`,

  // ── Project → Comments / Approvals ─────────────
  comments:              (pid: string)                 => `/api/projects/${pid}/comments`,
  approvals:             (pid: string)                 => `/api/projects/${pid}/approvals`,

  // ── Project → Task Review ──────────────────────
  taskReview:            (pid: string, tid: string)    => `/api/projects/${pid}/tasks/${tid}/review`,
  tasksPendingReview:    (pid: string)                 => `/api/projects/${pid}/tasks/pending-review`,

  // ── Tasks ───────────────────────────────────────
  tasks:                 ()                            => "/api/tasks",
  task:                  (id: string)                  => `/api/tasks/${id}`,
  taskStar:              (id: string)                  => `/api/tasks/${id}/star`,

  // ── Task → Checklist ───────────────────────────
  taskChecklist:         (tid: string)                 => `/api/tasks/${tid}/checklist`,
  taskChecklistItem:     (tid: string, iid: string)    => `/api/tasks/${tid}/checklist/${iid}`,
  taskChecklistReorder:  (tid: string)                 => `/api/tasks/${tid}/checklist/reorder`,

  // ── Task → Attachments ─────────────────────────
  taskAttachments:       (tid: string)                 => `/api/tasks/${tid}/attachments`,
  taskAttachment:        (tid: string, aid: string)    => `/api/tasks/${tid}/attachments/${aid}`,

  // ── Notifications ──────────────────────────────
  notifications:         ()                            => "/api/notifications",

  // ── Upload & Files ─────────────────────────────
  upload:                ()                            => "/api/upload",
  avatar:                ()                            => "/api/avatar",
  proxyFile:             (url: string)                 => `/api/proxy-file?url=${encodeURIComponent(url)}`,

  // ── Dashboard ──────────────────────────────────
  dashboard:             ()                            => "/api/dashboard",

  // ── Client Portal ──────────────────────────────
  clientProjects:        ()                            => "/api/client/projects",
} as const;
