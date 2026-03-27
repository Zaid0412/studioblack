# StudioBlack — Progress Tracker

> **Updated:** 2026-03-25 | **Ref:** [RDash](https://rdash.io/) | **Branch:** `main`

---

## Done

| Module              | What's built                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design Review**   | PDF viewer with annotations, approve/reject workflow, annotated PDF export, review history panel, comment tool, viewer toolbar (screenshot/print/fullscreen/download), thumbnail sidebar                        |
| **Version History** | Version uploads, version history dialog with badges, design freeze toggle, auto-freeze on approval, duplicate review guard, transaction-safe uploads                                                            |
| **Projects**        | Phases (6 architectural), 7-step workflow bar, file attachments with versioning, CRUD API with role-based restrictions, upload to Supabase Storage                                                              |
| **Client Portal**   | Unified routes under `(dashboard)` with `useUserRole` adaptation, client project list/detail/review pages, project-level approve/request-changes, role-adaptive components, i18n (EN + TR)                      |
| **Dashboard**       | Stats cards, empty states, deadlines panel, activity feed, custom Radix selects, refresh buttons                                                                                                                |
| **Org Management**  | Better Auth org plugin, create/invite/manage roles, onboarding flow, org settings page                                                                                                                          |
| **Task Manager**    | Smart buckets, CRUD with priority/category/status, starring, checklists with drag-reorder, file attachments with image preview, task detail modal, project-embedded task section, URL-driven filters/pagination |
| **Notifications**   | Batch inserts (no N+1), review/upload/assignment notifications, bell with unread count                                                                                                                          |
| **Auth & Security** | Email/password auth, centralized `withAuth()`, CSRF fail-closed, role-based access via org membership, SSRF-safe proxy, rate limiting, input validation, type-safe env (`src/env.ts`)                           |
| **Settings**        | Profile, password, preferences (theme/language), danger zone                                                                                                                                                    |

---

## Not Yet Built

**High:** Inter-org task collaboration, design sections & tags, RFIs, reporting dashboard

**Medium:** WBS / activity schedule, Gantt chart scheduling, budget tracking, snaglist / punch list, quality audits

**Low:** Vendor & procurement, field operations, mobile app (PWA), WhatsApp integration

---

## Architecture

|              |                                            |
| ------------ | ------------------------------------------ |
| Framework    | Next.js 16 (App Router) + React 19         |
| Styling      | Tailwind CSS v4                            |
| PDF          | EmbedPDF + PDFium WASM                     |
| Auth         | Better Auth (email/password + org plugin)  |
| DB + Storage | Supabase (Postgres via `pg` pool, Storage) |
| Email        | Brevo SMTP (nodemailer)                    |
| i18n         | `next-intl` (EN + TR)                      |
| DnD          | `@dnd-kit/core` + `@dnd-kit/sortable`      |
| Env          | Zod-validated (`src/env.ts`)               |

---

## Key Technical Decisions

- **EmbedPDF `Task<T>`** — `saveAsCopy()` returns `Task<ArrayBuffer>`, not `Promise`. Call `.toPromise()`.
- **ReviewPanel absolutely positioned** — prevents PDF viewer zoom oscillation from flex resizing.
- **Org role via member table** — never trust `session.user.role`; query via `getOrgRole()`.
- **Unified routes** — no separate `(client)` group; all pages adapt via `useUserRole` hook.
- **Lightbox via `createPortal`** — z-[200] on `document.body` to escape Radix Dialog focus trap.
- **CSRF fail-closed** — rejects missing `origin`/`host`, not just mismatch.
- **Type-safe env** — all `process.env` through Zod-validated `src/env.ts`. Zero raw access in src/.
- **Proxy-file SSRF** — hostname restricted to `NEXT_PUBLIC_SUPABASE_URL`, streaming with byte counter.
