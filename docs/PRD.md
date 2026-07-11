# StudioBlack — Product Requirements Document (PRD)

**Version:** 2.0
**Last Updated:** 2026-03-14
**Product:** StudioBlack — Architectural Design Review & Approval Platform
**Tagline:** "Design Reviews, Simplified"

---

## 1. Executive Summary

StudioBlack is a web-based platform purpose-built for architectural and interior design studios to manage the full lifecycle of a project — from initial design layouts through final handover. It provides a structured, phase-driven workflow where **Project Managers (PMs)** create and oversee projects, **Architects** execute design tasks, and **Clients** review and approve deliverables. The platform replaces fragmented email/WhatsApp-based approval workflows with a centralized hub featuring role-based dashboards, real-time notifications, task management, file uploads, comments, and a dedicated client portal.

---

## 2. Problem Statement

Architectural studios currently rely on a patchwork of tools (email, WhatsApp, Google Drive, spreadsheets) to manage design reviews and client approvals. This leads to:

- **Lost context** — feedback scattered across channels with no single source of truth
- **Missed deadlines** — no structured phase tracking or task accountability
- **Slow approvals** — clients don't have a clear, simple way to review and sign off on deliverables
- **No audit trail** — decisions, comments, and file versions are hard to trace
- **Team confusion** — architects lack visibility into what's assigned to them vs. the broader project

---

## 3. Target Users & Roles

| Role                   | Access Level         | Description                                                                                                                              |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **PM / Owner**         | Full                 | Creates the organization, manages team members, creates projects, assigns architects, sends deliverables to clients, oversees everything |
| **PM / Admin**         | Full (non-org-owner) | Same as Owner but cannot delete the organization. Invited by Owner                                                                       |
| **Architect / Member** | Project-scoped       | Works on assigned projects only. Can create tasks, upload files, comment. Can view (read-only) the organization page and leave the org   |
| **Client**             | Project-scoped       | External stakeholder. Accesses projects via magic link. Reviews tasks, approves/rejects deliverables, comments                           |

---

## 4. Tech Stack

| Layer              | Technology                                                      |
| ------------------ | --------------------------------------------------------------- |
| **Framework**      | Next.js 16 (App Router, React 19, Server Components)            |
| **Language**       | TypeScript 5                                                    |
| **Styling**        | Tailwind CSS 4, Radix UI primitives, Lucide icons               |
| **Authentication** | better-auth (email/password + magic link + organization plugin) |
| **Database**       | PostgreSQL (Supabase-hosted) via `pg` driver                    |
| **File Storage**   | Supabase Storage (50 MB upload limit)                           |
| **Email**          | Nodemailer + Brevo SMTP relay                                   |
| **i18n**           | next-intl (multi-language ready)                                |
| **Deployment**     | Vercel (planned)                                                |

---

## 5. Information Architecture

### 5.1 Route Structure

```
/                           → Redirect to /login
/(auth)/login               → Sign in (email/password)
/(auth)/register            → Sign up
/(auth)/onboarding          → First-time org setup

/(dashboard)/dashboard      → PM/Architect home: stats, activity, deadlines
/(dashboard)/projects       → Project list (filterable, searchable)
/(dashboard)/projects/new   → Create new project
/(dashboard)/projects/[id]  → Project detail (phases, tasks, team, files, comments)
/(dashboard)/projects/[id]/upload → Upload attachments
/(dashboard)/projects/[id]/edit   → Edit project details
/(dashboard)/tasks          → Architect's personal task board (cross-project)
/(dashboard)/settings?section=organization → Team management (invite, remove, roles)
/(dashboard)/notifications  → Notification center
/(dashboard)/settings       → Profile & account settings
/(dashboard)/audit          → Activity / audit history

/(client)/client-dashboard              → Client home
/(client)/client-dashboard/projects     → Client's project list
/(client)/client-dashboard/projects/[id] → Project detail (review tasks, approve, comment)
/(client)/client-dashboard/settings     → Client profile settings
/(client)/client-dashboard/notifications → Client notification center
```

### 5.2 Navigation

The sidebar adapts to the user's role:

- **PM nav:** Dashboard, Projects, Organisation, Notifications (with badge), Settings, Audit History
- **Architect nav:** Dashboard, Projects, Tasks, Organisation, Notifications (with badge), Settings
- **Client nav:** Dashboard, Projects, Notifications (with badge), Settings

Sidebar supports a collapsed (icon-only) mode with smooth animation.

---

## 6. Database Schema

### 6.1 Core Tables

#### `project`

| Column       | Type        | Notes                                                                              |
| ------------ | ----------- | ---------------------------------------------------------------------------------- |
| id           | UUID (PK)   | Auto-generated                                                                     |
| name         | TEXT        | Required                                                                           |
| client_name  | TEXT        | Client's display name                                                              |
| client_email | TEXT        | Used for client access & magic links                                               |
| category     | TEXT        | residential, commercial, healthcare, hospitality, institutional, retail, workspace |
| status       | TEXT        | draft, active, completed, archived                                                 |
| description  | TEXT        | Optional project brief                                                             |
| deadline     | DATE        | Target completion date                                                             |
| org_id       | TEXT (FK)   | References better-auth `organization`                                              |
| created_by   | TEXT (FK)   | References `user`                                                                  |
| created_at   | TIMESTAMPTZ | Auto                                                                               |
| updated_at   | TIMESTAMPTZ | Auto                                                                               |

#### `project_member`

| Column     | Type      | Notes                 |
| ---------- | --------- | --------------------- |
| id         | UUID (PK) |                       |
| project_id | UUID (FK) |                       |
| user_id    | TEXT (FK) |                       |
| role       | TEXT      | Default: "architect"  |
| UNIQUE     |           | (project_id, user_id) |

#### `project_phase`

| Column      | Type      | Notes                               |
| ----------- | --------- | ----------------------------------- |
| id          | UUID (PK) |                                     |
| project_id  | UUID (FK) |                                     |
| name        | TEXT      | Phase name                          |
| phase_order | INT       | 1–8                                 |
| status      | TEXT      | not_started, in_progress, completed |

#### `phase_task`

| Column                 | Type      | Notes                                             |
| ---------------------- | --------- | ------------------------------------------------- |
| id                     | UUID (PK) |                                                   |
| phase_id               | UUID (FK) |                                                   |
| title                  | TEXT      | Task name                                         |
| description            | TEXT      | Optional details                                  |
| status                 | TEXT      | pending, in_progress, completed                   |
| assigned_to            | TEXT (FK) | Nullable; references `user`                       |
| requires_client_review | BOOLEAN   | Default false                                     |
| review_status          | TEXT      | NULL, pending_review, approved, changes_requested |
| due_date               | DATE      | Optional                                          |

#### `attachment`

| Column      | Type      | Notes                      |
| ----------- | --------- | -------------------------- |
| id          | UUID (PK) |                            |
| project_id  | UUID (FK) | Required                   |
| phase_id    | UUID (FK) | Nullable (scoped to phase) |
| task_id     | UUID (FK) | Nullable (scoped to task)  |
| uploaded_by | TEXT (FK) |                            |
| file_url    | TEXT      | Supabase Storage URL       |
| file_name   | TEXT      | Original filename          |
| description | TEXT      | Optional caption           |

#### `comment`

| Column     | Type      | Notes          |
| ---------- | --------- | -------------- |
| id         | UUID (PK) |                |
| project_id | UUID (FK) | Required       |
| phase_id   | UUID (FK) | Nullable       |
| task_id    | UUID (FK) | Nullable       |
| user_id    | TEXT (FK) | Comment author |
| content    | TEXT      | Comment body   |

#### `approval`

| Column     | Type      | Notes                       |
| ---------- | --------- | --------------------------- |
| id         | UUID (PK) |                             |
| project_id | UUID (FK) |                             |
| phase_id   | UUID (FK) | Nullable                    |
| user_id    | TEXT (FK) | Client who submitted        |
| decision   | TEXT      | approved, changes_requested |
| comment    | TEXT      | Optional feedback           |

#### `notification`

| Column      | Type      | Notes                        |
| ----------- | --------- | ---------------------------- |
| id          | UUID (PK) |                              |
| user_id     | TEXT (FK) | Recipient                    |
| type        | TEXT      | See notification types below |
| title       | TEXT      | Short headline               |
| description | TEXT      | Detail text                  |
| project_id  | UUID (FK) | Nullable                     |
| task_id     | UUID (FK) | Nullable                     |
| read        | BOOLEAN   | Default false                |

### 6.2 Authentication Tables (better-auth managed)

- `user` — id, name, email, emailVerified, image, role (pm/architect/client), initials, createdAt, updatedAt
- `session` — id, expiresAt, token, userId, etc.
- `account` — id, userId, providerId, accountId, password hash, etc.
- `verification` — id, identifier, value, expiresAt
- `organization` — id, name, slug, logo, metadata, createdAt
- `member` — id, organizationId, userId, role (owner/admin/member), createdAt

---

## 7. Feature Specifications

### 7.1 Authentication & Onboarding

**Sign Up / Sign In**

- Email + password authentication
- Auto-verification on account creation (no email confirmation step)
- Session token stored in cookies; middleware redirects unauthenticated users to `/login`

**Magic Link Access (Client)**

- PM sends project to client via "Send to Client" action
- System auto-creates a client user account if the email doesn't exist
- Client receives a branded magic link email (15-minute expiry)
- Magic link grants access directly to the client dashboard

**Onboarding**

- First-time users are routed to `/onboarding` to set up their organization name

**Organization Plugin**

- Org-level roles: owner, admin (PM), member (architect)
- Invitation flow: PM invites team member by email → invitation email sent → invitee signs up and joins org
- Members can view org page (read-only) and leave the organization

### 7.2 Project Management

**Project Creation (PM only)**

- Fields: name, client name, client email, category, deadline, description, assign architects
- On creation, 8 fixed phases are auto-generated:
  1. 2D Layout + Look & Feel
  2. 3D Design Development & Budgetary BOQ
  3. Services & Working Drawings
  4. Material Selections
  5. Detailed BOQ & Contractor Finalization
  6. Site Work
  7. Vendor & Accessories
  8. Final Handover
- Assigned architects become `project_member` records
- Architects receive email + in-app notification

**Project Listing**

- PM sees all org projects
- Architect sees only assigned projects
- Client sees projects where their email matches `client_email`
- Filterable by status; searchable by name

**Project Detail Page**

- Header: project name, client, category, status, deadline
- Phases: expandable accordion, each showing tasks within that phase
- Team members sidebar
- Comments section (project-level)
- Attachments section

**Send to Client**

- PM action that sends a magic link email to the client
- Auto-creates client user account if needed
- Client can then access the project from their portal

### 7.3 Phase & Task Management

**Phases**

- 8 predefined phases per project (not user-customizable)
- Statuses: not_started → in_progress → completed
- Expandable on the project detail page; shows tasks within

**Tasks**

- Created within a phase by PM or Architect
- Fields: title, description (optional), assigned architect, due date, status
- Statuses: pending → in_progress → completed
- Can be flagged for client review via "Request Client Review"

**Client Review Workflow**

1. PM/Architect creates task and assigns it to an architect
2. When ready, PM/Architect clicks "Request Client Review" on the task
3. Client receives email notification + in-app notification
4. Client sees the task under "Tasks Pending Your Review" on their project page
5. Client approves or requests changes (with optional comment)
6. Team receives notification of the decision
7. Task `review_status` updates to `approved` or `changes_requested`

**Project-Level Approval**

- Separate from task reviews
- Client sees a "Your Decision" card (approve / request changes) when:
  - There are no pending task reviews AND there are attachments to review
- Decision is recorded in the `approval` table
- If approved, project status updates to `completed`

### 7.4 File Uploads & Attachments

- Upload via Supabase Storage (max 50 MB per file)
- Supported at project, phase, or task level
- File metadata stored in `attachment` table
- Client receives email + in-app notification when files are uploaded
- Avatar uploads: JPEG/PNG/WebP, max 1 MB, stored in Supabase

### 7.5 Comments & Discussion

- Available on project, phase, or task level
- Any authenticated user can comment
- Comments are displayed in chronological order with author info
- Posting a comment triggers:
  - In-app notification to all team members (except author)
  - In-app notification to the client (if applicable)
  - Email notification

### 7.6 Notification System

**In-App Notifications**

Created via server-side helpers:

- `createNotification()` — single recipient
- `createNotificationsForTeam()` — all org members except triggering user
- `createNotificationForClient()` — project's client user

Notification types:
| Type | Icon | Trigger |
|------|------|---------|
| `comment` | MessageSquare | Comment posted on project/phase/task |
| `upload` | Upload | File attachment added |
| `approval` | CheckCircle2 | Client submits approval decision |
| `review_requested` | ClipboardCheck | Task flagged for client review |
| `review_submitted` | AlertTriangle | Client submits task review |
| `task_assigned` | ListChecks | Task assigned to architect |
| `invitation` | UserPlus | Organization invitation received/sent |

**Notification Pages**

- PM/Architect: Shows both organization invitations (from better-auth) and DB notifications, merged and sorted by date
- Client: Shows DB notifications only
- Grouped by: Today, Yesterday, Earlier
- Click to mark as read + navigate to related project
- "Mark All Read" bulk action
- Auto-refresh: invitations every 10s, DB notifications every 15s

**Sidebar Badge**

- Unread count = pending invitations + unread DB notifications
- Refreshes every 10 seconds
- Listens for `notifications-changed` custom event for instant updates

**Email Notifications**

Sent via Nodemailer + Brevo SMTP for:

- New project assignment (to architect)
- New file upload (to client)
- Review requested (to client)
- Review submitted (to team)
- Approval decision (to team)
- Comment posted (to team & client)
- Organization invitation (to invitee)
- Magic link (to client)

All emails use branded HTML templates with the StudioBlack logo and yellow (#F5C518) accent color.

### 7.7 Organization Management

**PM/Owner capabilities:**

- View all team members with roles
- Invite new members by email (with role selection)
- Remove members from organization
- Cancel pending invitations

**PM/Admin capabilities:**

- Same as Owner (except cannot delete org)

**Architect capabilities:**

- View organization page (read-only): see team members and their roles
- Leave organization (red "Leave Organisation" button with confirmation dialog)
- Accept/reject organization invitations from the notifications page

**Client capabilities:**

- No access to organization management

### 7.8 Dashboard

**PM/Architect Dashboard**

- Stat cards: Active Projects, Pending Reviews, Approvals, Team Size
- Recent activity feed (comments, uploads, approvals, reviews)
- Upcoming deadlines

**Client Dashboard**

- Stat cards: Active Projects, Items for Review, Approved Items
- Project list with status indicators

### 7.9 Architect Tasks Page

- Dedicated `/tasks` route for architects
- Shows all tasks assigned to the current user across all projects
- Sorted by status and due date
- Quick navigation to parent project

### 7.10 Settings

- Profile editing: name, initials, avatar upload
- Password change
- Account deletion (with confirmation)

### 7.11 Audit History

- Feature-flagged (`features.auditHistory`)
- Activity log of all project actions
- Filterable by project, user, action type

---

## 8. Feature Flags

Configurable in `src/config/features.ts`:

| Flag             | Default | Description                                |
| ---------------- | ------- | ------------------------------------------ |
| `magicLink`      | false   | Show magic link option on login page       |
| `teamManagement` | true    | Enable organization/team management        |
| `auditHistory`   | true    | Enable audit log page                      |
| `clientPortal`   | true    | Enable client-facing routes                |
| `notifications`  | true    | Enable notification center + sidebar badge |
| `designUpload`   | true    | Enable file upload functionality           |

---

## 9. Access Control Matrix

| Action                  | PM (Owner/Admin) |   Architect (Member)    | Client |
| ----------------------- | :--------------: | :---------------------: | :----: |
| Create project          |       Yes        |           No            |   No   |
| Edit project            |       Yes        |         Limited         |   No   |
| Delete project          |       Yes        |           No            |   No   |
| View all org projects   |       Yes        |           No            |   No   |
| View assigned projects  |       Yes        |           Yes           |  N/A   |
| View projects by email  |       N/A        |           N/A           |  Yes   |
| Create tasks            |       Yes        | Yes (assigned projects) |   No   |
| Assign tasks            |       Yes        |           Yes           |   No   |
| Request client review   |       Yes        |           Yes           |   No   |
| Submit task review      |        No        |           No            |  Yes   |
| Submit project approval |        No        |           No            |  Yes   |
| Upload attachments      |       Yes        |           Yes           |   No   |
| Post comments           |       Yes        |           Yes           |  Yes   |
| Manage team             |       Yes        |        Read-only        |   No   |
| Leave organization      |        No        |           Yes           |  N/A   |
| Send project to client  |       Yes        |           No            |   No   |

---

## 10. API Reference

### Authentication

| Method | Endpoint             | Description                                             |
| ------ | -------------------- | ------------------------------------------------------- |
| \*     | `/api/auth/[...all]` | better-auth catch-all (sign-in, sign-up, session, etc.) |

### Projects

| Method | Endpoint                            | Description                           |
| ------ | ----------------------------------- | ------------------------------------- |
| GET    | `/api/projects`                     | List projects (role-filtered)         |
| POST   | `/api/projects`                     | Create project + phases + assignments |
| GET    | `/api/projects/[id]`                | Get project detail                    |
| PATCH  | `/api/projects/[id]`                | Update project fields                 |
| POST   | `/api/projects/[id]/send-to-client` | Send magic link to client             |

### Tasks

| Method | Endpoint                                           | Description                  |
| ------ | -------------------------------------------------- | ---------------------------- |
| GET    | `/api/projects/[id]/tasks?phaseId=`                | List tasks for a phase       |
| POST   | `/api/projects/[id]/tasks`                         | Create task                  |
| PATCH  | `/api/projects/[id]/tasks`                         | Update task                  |
| GET    | `/api/projects/[id]/tasks/pending-review`          | Tasks awaiting client review |
| POST   | `/api/projects/[id]/tasks/[taskId]/request-review` | Flag task for client review  |
| POST   | `/api/projects/[id]/tasks/[taskId]/review`         | Client submits review        |

### Comments & Attachments

| Method | Endpoint                         | Description              |
| ------ | -------------------------------- | ------------------------ |
| GET    | `/api/projects/[id]/comments`    | List comments            |
| POST   | `/api/projects/[id]/comments`    | Add comment              |
| GET    | `/api/projects/[id]/attachments` | List attachments         |
| POST   | `/api/projects/[id]/attachments` | Create attachment record |

### Approvals

| Method | Endpoint                       | Description              |
| ------ | ------------------------------ | ------------------------ |
| GET    | `/api/projects/[id]/approvals` | List approval records    |
| POST   | `/api/projects/[id]/approvals` | Submit approval decision |

### Files & User

| Method | Endpoint          | Description                     |
| ------ | ----------------- | ------------------------------- |
| POST   | `/api/upload`     | Upload file to Supabase Storage |
| POST   | `/api/avatar`     | Upload profile avatar           |
| GET    | `/api/user/tasks` | Current user's assigned tasks   |

### Notifications

| Method | Endpoint             | Description                                      |
| ------ | -------------------- | ------------------------------------------------ |
| GET    | `/api/notifications` | List notifications (or `?unread=true` for count) |
| PATCH  | `/api/notifications` | Mark as read (by IDs or all)                     |

### Client

| Method | Endpoint               | Description                       |
| ------ | ---------------------- | --------------------------------- |
| GET    | `/api/client/projects` | Projects for authenticated client |

---

## 11. Branding & Configuration

| Key            | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| App Name       | StudioBlack                                                         |
| Tagline        | "Design Reviews, Simplified"                                        |
| Subtitle       | "Streamlined architectural design review & approval"                |
| Logo           | `https://studio-black.co.in/wp-content/uploads/2024/05/SB_logo.png` |
| Support Email  | support@studioblack.com                                             |
| Primary Accent | Yellow (#F5C518) in emails                                          |

---

## 12. Environment Configuration

| Variable                    | Required | Description                            |
| --------------------------- | -------- | -------------------------------------- |
| `BETTER_AUTH_SECRET`        | Yes      | Auth encryption key (base64, 32 bytes) |
| `BETTER_AUTH_URL`           | Yes      | App base URL                           |
| `DATABASE_URL`              | Yes      | PostgreSQL connection string           |
| `NEXT_PUBLIC_SUPABASE_URL`  | Yes      | Supabase project URL                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase admin key                     |
| `EMAIL_FROM`                | Yes      | Sender address for emails              |
| `SMTP_HOST`                 | No       | Default: smtp-relay.brevo.com          |
| `SMTP_PORT`                 | No       | Default: 587                           |
| `SMTP_USER`                 | Yes      | Brevo SMTP username                    |
| `SMTP_PASS`                 | Yes      | Brevo SMTP password                    |

---

## 13. Fixed Project Phases

Every project is created with these 8 phases (in order):

1. **2D Layout + Look & Feel** — Initial space planning and mood boards
2. **3D Design Development & Budgetary BOQ** — 3D renders and preliminary costing
3. **Services & Working Drawings** — MEP and structural coordination
4. **Material Selections** — Finishes, fixtures, and material specifications
5. **Detailed BOQ & Contractor Finalization** — Final quantities and contractor selection
6. **Site Work** — Construction and installation oversight
7. **Vendor & Accessories** — Procurement and vendor management
8. **Final Handover** — Punch list, documentation, and project close-out

---

## 14. Key User Flows

### Flow 1: PM Creates a Project

1. PM navigates to `/projects/new`
2. Fills in: name, client name, client email, category, deadline, description
3. Selects architects from the org team to assign
4. Submits → project created with 8 phases + member assignments
5. Assigned architects receive email + in-app notification

### Flow 2: PM Sends Project to Client

1. PM opens project detail page
2. Clicks "Send to Client"
3. System auto-creates client user if email is new
4. Client receives magic link email (15-min expiry)
5. Client clicks link → lands on client dashboard with project access

### Flow 3: Architect Works on Tasks

1. Architect views `/tasks` to see all assigned tasks across projects
2. Opens a project → expands a phase → sees tasks
3. Creates new tasks, uploads files, adds comments
4. When ready for client feedback → clicks "Request Client Review" on a task
5. Client receives email + in-app notification

### Flow 4: Client Reviews Deliverables

1. Client receives notification (email + in-app)
2. Logs in via magic link or existing session
3. Navigates to project → sees "Tasks Pending Your Review" section
4. Reviews each task: clicks Approve or Request Changes (with optional comment)
5. Team receives notification of the decision
6. When no tasks are pending review, a general project-level "Your Decision" card appears (if attachments exist)

### Flow 5: Organization Management

1. PM/Owner invites team members by email with role selection
2. Invitee receives email with signup link
3. Invitee creates account → auto-joins organization
4. Architects can view the org page read-only and leave via "Leave Organisation" button
5. PM can remove members or cancel pending invitations

---

## 15. Non-Functional Requirements

| Requirement                | Target                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| **Authentication**         | Session-based with cookie tokens; middleware-level route protection |
| **Authorization**          | Role-based access at API and UI levels                              |
| **File Upload Limit**      | 50 MB per file (Supabase Storage)                                   |
| **Avatar Limit**           | 1 MB (JPEG/PNG/WebP)                                                |
| **Email Delivery**         | Brevo SMTP relay; branded HTML templates                            |
| **Notification Freshness** | Auto-refresh every 10–15 seconds                                    |
| **i18n**                   | Multi-language ready via next-intl                                  |
| **Responsive Design**      | Desktop-first with sidebar collapse for smaller screens             |
| **Error Handling**         | Non-blocking notifications (failures don't break main operations)   |

---

## 16. Future Considerations

- **Real-time updates** — WebSocket or SSE for instant notifications instead of polling
- **File versioning** — Track attachment versions per phase/task
- **Gantt chart / timeline view** — Visual phase and task scheduling
- **Client commenting on specific file regions** — Pin-drop annotations on uploaded designs
- **Mobile app** — React Native or PWA for on-site use
- **Advanced reporting** — Project analytics, team performance, approval velocity
- **Custom phases** — Allow PMs to define their own phase templates
- **Third-party integrations** — Google Drive, Dropbox, Slack, AutoCAD
- **RDash-style UI refresh** — Modernize the interface to match construction management SaaS patterns (card-based layouts, enhanced dashboards, visual status indicators)

---

_This PRD reflects the current implemented state of StudioBlack as of March 2026. All features listed in Sections 7–10 are functional and deployed._
