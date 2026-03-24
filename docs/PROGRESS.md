---
# StudioBlack — Progress Tracker

> **Last updated:** 2026-03-24
> **Reference:** [RDash](https://rdash.io/) (construction/interior project management platform)
> **Branch:** `main`

---

## ✅ Completed Features

### Design Review System

- [x] PDF viewer with real-time annotations (EmbedPDF + PDFium WASM)
- [x] Approve / Request Changes workflow (GitHub-style review flow)
- [x] Annotated PDF export — client marks up PDF, saved as review artifact
- [x] Review history side panel — all reviews with status, comments, annotated PDF links
- [x] Comment tool toggle — activates EmbedPDF's built-in text comment annotation
- [x] Screenshot, print, fullscreen, download tools in viewer toolbar
- [x] Thumbnail sidebar — browse phase files while in review view

### Version History & Design Freeze

- [x] Upload new file versions within a version group
- [x] Version history dialog — view all versions with color-coded badges (latest, reviewed, frozen)
- [x] Version groups scoped to project (prevents cross-project leakage)
- [x] Transaction-wrapped version uploads with `SELECT ... FOR UPDATE` (no race conditions)
- [x] Design freeze toggle — freeze/unfreeze files from review page toolbar
- [x] Upload blocked on frozen files
- [x] Auto-freeze on approval (status update + freeze in single transaction)
- [x] Duplicate review guard — 409 if file already in target review state

### Project Structure

- [x] Projects with phases (6 architectural phases: 2D Layout, 3D Layout, Production Files, Section View, Plumbing Section View, Floor Plans)
- [x] 7-step workflow bar (Briefing → Design → Review → Revision → Approval → Production → Handover)
- [x] File attachments per phase with versioning
- [x] File upload to Supabase Storage
- [x] File context menu with "View Review" option for reviewed files
- [x] Project CRUD API with role-based field restrictions (PM vs architect)
- [x] Create project form with required field validation toasts

### Client Portal (Unified)

- [x] Unified route structure — all pages under `(dashboard)`, UI adapts based on `useUserRole` hook
- [x] Backward-compatible redirects from `/client-dashboard/*` → `/dashboard`
- [x] Client projects list page (table with search, status/sort dropdowns, pagination — matches PM layout)
- [x] Client project detail page with file list, review status badges, approval history
- [x] Project-level approve / request changes (GitHub PR-style buttons in header)
- [x] Client review page with annotation + submit review bar
- [x] Role-adaptive components: ApprovalButtons, ApprovalHistory, CompletedBanner, PendingTasksBanner, RequestChangesDialog
- [x] Full i18n (English + Turkish) on client project detail page

### Dashboard & Navigation

- [x] PM dashboard with stats cards (active projects, pending reviews, approved, team members)
- [x] Dashboard empty states with icons, descriptions, and welcome banner
- [x] Custom Radix UI Select dropdowns (replaced native selects)
- [x] Upcoming deadlines panel
- [x] Recent activity feed from notifications
- [x] Refresh buttons on dashboard pages

### Organisation Management

- [x] Better Auth organization plugin (owner/admin/member roles)
- [x] Create org, invite members, manage roles
- [x] Onboarding flow for new users (create or join org)
- [x] Org settings page with member list, pending invitations, leave/delete

### Task Manager

- [x] Standalone task system with smart buckets (All, My Tasks, Created by Me, Starred, Upcoming, Completed)
- [x] Task CRUD with priority (low/medium/high/urgent), category (general/design/review/revision/production/handover), and status transitions
- [x] Project-scoped and standalone (non-project) tasks
- [x] Per-user task starring with optimistic UI
- [x] Checklist/subtask system with inline add, toggle, delete, and progress bar
- [x] Drag-to-reorder checklist items (`@dnd-kit/core` + `@dnd-kit/sortable`)
- [x] File attachments with upload, download, delete, and color-coded file type badges
- [x] Inline image preview with loading state and fullscreen lightbox (portaled above Radix Dialog)
- [x] Task detail modal with metadata grid, checklist, attachments, and action buttons
- [x] Embedded TaskSection component on project detail page (phase-filtered, highlight-from-URL)
- [x] URL-driven filters, search, and pagination on `/tasks` page
- [x] Org-scoped authorization on all task API routes (IDOR prevention)
- [x] Atomic star toggle with DB transaction, input validation, sanitized error messages
- [x] Shared types (`Task`, `TaskFormData`) and utils (`taskUtils.ts`) — eliminated ~228 lines of duplication

### Notifications

- [x] Notification system with batch inserts (`INSERT...SELECT`, no N+1)
- [x] PM/architects notified when client submits a review
- [x] Client notified when files are sent for review
- [x] Task assignment notifications (assignee notified on create/reassign)
- [x] Notification bell with unread count + mark as read

### Auth & Security

- [x] Email/password authentication with Better Auth
- [x] Centralized `withAuth()` helper — session, role, org, and project-access checks in one wrapper (19 route handlers refactored)
- [x] `withAuth` provides `orgId` in context — resolved from session with fallback
- [x] Fail-closed CSRF on mutating requests — rejects missing `origin` or `host` headers
- [x] Role-based access: org membership checked via `getOrgRole()` (not `user.role`)
- [x] Proxy-file route with SSRF prevention (protocol check, hostname allowlist, no redirects, streaming with byte counter)
- [x] Rate limiting on all mutating endpoints (in-memory sliding window)
- [x] Hostname-parsed `fileUrl` validation (prevents subdomain bypass)
- [x] SQL wildcard escaping for ILIKE patterns
- [x] Input validation: description length cap, review status whitelist, annotation count validation
- [x] PATCH field restrictions — PM can edit all fields, architects limited to name/description
- [x] DELETE restricted to org owner/admin only
- [x] Type-safe environment system (`src/env.ts`) — Zod-validated, zero raw `process.env` in src/

### Settings

- [x] Profile section (name, email, avatar)
- [x] Password change
- [x] Preferences (theme toggle, language)
- [x] Danger zone (delete account)

### Code Quality

- [x] Centralized API layer (`src/lib/api/`) with route map, typed client, and concrete return types
- [x] Shared hooks: `useDesignReview`, `useCommentTool`, `usePdfPlugins`, `useAnnotationTracker`, `useTaskCrud`, `useProjectDetail`, `useProjectList`, `useNotifications`, `useFileUpload`, `useAvatarUpload`, `useUserRole`, `useTaskDetail`
- [x] Shared components: `ReviewToolbar`, `ReviewPanel`, `DocumentViewer`, `ThumbnailPanel`, `Pagination`, `RefreshButton`, `UploadDialog`, `TaskFormDialog`, `TaskDeleteDialog`
- [x] Shared task utilities: `taskUtils.ts` (constants, display maps, helpers)
- [x] Client review page refactored from 427 → ~160 lines
- [x] Dashboard stats consolidated into single CTE query
- [x] `getProjectById` parallelized with `Promise.all`
- [x] SQL pagination with `LIMIT/OFFSET` and `COUNT(*) OVER()` window function
- [x] `useMemo` on computed values (phaseCounts, phaseFiles, filteredTasks)
- [x] Stable refs in hooks, deduplicated fetch logic
- [x] All kebab-case files renamed to camelCase
- [x] i18n via `next-intl` (EN + TR)
- [x] 404 not-found page with brand styling
- [x] Stable avatar colors using user ID (not display name)
- [x] BrandLogo using `next/image` with remote patterns
- [x] ESLint fully clean (0 errors, 0 warnings)

---

## 🚧 In Progress

_(nothing currently in progress)_

---

## 📋 Not Yet Built

> Features [RDash](https://rdash.io/) has that StudioBlack doesn't — prioritized by relevance to interior/construction design workflows.

### 🔴 High Priority

| Feature                        | Description                                                                                         | Reference |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | --------- |
| Inter-org task collaboration   | Assign tasks across organizations (e.g. contractor ↔ architect)                                     | —         |
| Design sections & tags         | Organize files into logical sections (e.g. "Electrical", "Flooring") with custom tags for filtering | —         |
| RFIs (Request for Information) | Field teams raise clarification requests on specific designs, tracked with status                   | —         |
| Reporting dashboard            | Project-level insights: review progress, file status breakdown, timeline adherence                  | —         |

### 🟡 Medium Priority

| Feature                 | Description                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Activity Schedule / WBS | Work Breakdown Structure with hierarchical task decomposition, dependencies, and real-time timeline monitoring |
| Project scheduling      | Gantt chart / timeline view for phases with start/end dates, delay alerts                                      |
| Budget tracking         | Project budget, cost tracking per phase, change orders, cashflow overview                                      |
| Snaglist / Punch list   | Capture pending issues on-site, track closure, attach photos                                                   |
| Quality audits          | Spec guidelines, audit checklists, compliance tracking                                                         |

### 🔵 Lower Priority (Full Platform Play)

| Feature              | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| Vendor & procurement | Vendor pool, RFQs, rate contracts, order tracking, performance ratings |
| Field operations     | Mobile-first site surveys, measurements, observations                  |
| Mobile app           | Native or PWA for field team access to designs, reviews, snaglists     |
| WhatsApp integration | Real-time field updates and progress reporting via WhatsApp            |

---

## 🏗 Architecture

| Component      | Tech                                                       |
| -------------- | ---------------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19                         |
| Styling        | Tailwind CSS v4                                            |
| PDF Viewer     | `@embedpdf/react-pdf-viewer` + PDFium WASM                 |
| Auth           | Better Auth (email/password + organization plugin)         |
| Storage        | Supabase Storage (public bucket)                           |
| Database       | Supabase (Postgres) via `pg` pool                          |
| Email          | Brevo SMTP (nodemailer)                                    |
| i18n           | `next-intl` (EN + TR)                                      |
| Notifications  | Batch `INSERT...SELECT` via `createNotificationsForTeam()` |
| Drag & Drop    | `@dnd-kit/core` + `@dnd-kit/sortable`                      |
| Env Validation | Zod schemas in `src/env.ts`                                |

---

## ⚠️ Key Technical Decisions

- **EmbedPDF `Task<T>`** — `saveAsCopy()` returns `Task<ArrayBuffer>`, not `Promise`. Must call `.toPromise()` before awaiting.
- **React 19 strict mode** — async effects must check cancellation before mutating refs.
- **ReviewPanel is absolutely positioned** — prevents PDF viewer zoom oscillation caused by flex siblings resizing.
- **Slot-based toolbar API** — `leftSlot` (client status badge) and `rightSlot` (dashboard reviews toggle) keep the shared component flexible without prop explosion.
- **Org role via member table** — `session.user.role` is unreliable; always query `member` table with `getOrgRole()` for actual org permissions.
- **Proxy-file SSRF prevention** — URL restricted to `NEXT_PUBLIC_SUPABASE_URL` hostname, not generic `.supabase.co` pattern. Streaming with byte counter, no redirects.
- **Lightbox via `createPortal`** — rendered to `document.body` at z-[200] to escape Radix Dialog's focus trap and overlay. `onOpenChange` intercepted to prevent dialog closing when lightbox closes.
- **Unified routes over separate route groups** — eliminated `(client)` route group; all pages under `(dashboard)` adapt via `useUserRole` hook. Less code, single source of truth.
- **Type-safe env** — all `process.env` access through `src/env.ts` with Zod validation. Server vars validated lazily, client vars at module load. Zero raw access in `src/`.
- **CSRF fail-closed** — mutating requests rejected if `origin` OR `host` header is missing, not just on mismatch.
- **Rate limiter cleanup tracks max window** — cleanup interval uses the largest `windowMs` seen across all callers, not a hardcoded value.
- **Windows bash exit code 1** — shell profile error causes all commands to exit 1; check actual exit code via `echo "EXIT:$?"`.

---

Changes made (2026-03-24):

- Last updated → 2026-03-24
- Added "Version History & Design Freeze" section (8 items) — moved from Not Yet Built
- Renamed "Client Portal" → "Client Portal (Unified)" — updated to reflect route unification, added useUserRole, redirects, role-adaptive components
- Added "Refresh buttons" under Dashboard
- Expanded "Auth & Security" with CSRF fail-closed, rate limiting, hostname-parsed fileUrl, SQL escaping, input validation, type-safe env
- Added "Centralized API layer" and expanded shared hooks/components lists under Code Quality
- Added SQL pagination, useMemo, stable refs, ESLint clean under Code Quality
- Added "Env Validation" to Architecture table
- Removed "Version history" and "Design freeze" from Not Yet Built high priority
- Added 5 new Key Technical Decisions (unified routes, type-safe env, CSRF fail-closed, rate limiter cleanup, proxy-file streaming)
