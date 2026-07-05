# StudioBlack — Progress Tracker

> **Updated:** 2026-07-05 | **Ref:** [RDash](https://rdash.io/) | **Branch:** `main`

---

## Done

| Module              | What's built                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Design Review**   | PDF viewer with annotations, approve/reject workflow, annotated PDF export, review history panel, comment tool, viewer toolbar (screenshot/print/fullscreen/download), thumbnail sidebar                                                                                                                                                          |
| **Version History** | Version uploads, version history dialog with badges, design freeze toggle, auto-freeze on approval, duplicate review guard, transaction-safe uploads                                                                                                                                                                                              |
| **Projects**        | Phases (6 architectural), 7-step workflow bar, file attachments with versioning, CRUD API with role-based restrictions, upload to Supabase Storage                                                                                                                                                                                                |
| **Client Portal**   | Unified routes under `(dashboard)` with `useUserRole` adaptation, client project list/detail/review pages, project-level approve/request-changes, role-adaptive components, i18n (EN + TR)                                                                                                                                                        |
| **Dashboard**       | Stats cards, empty states, deadlines panel, activity feed, custom Radix selects, refresh buttons                                                                                                                                                                                                                                                  |
| **Org Management**  | Better Auth org plugin, create/invite/manage roles, onboarding flow, org settings page                                                                                                                                                                                                                                                            |
| **Task Manager**    | Smart buckets, CRUD with priority/category/status, starring, checklists with drag-reorder, file attachments with image preview, task detail modal, project-embedded task section, URL-driven filters/pagination                                                                                                                                   |
| **Notifications**   | Batch inserts (no N+1), review/upload/assignment notifications, bell with unread count                                                                                                                                                                                                                                                            |
| **Auth & Security** | Email/password auth, centralized `withAuth()`, CSRF fail-closed, role-based access via org membership, SSRF-safe proxy, rate limiting, input validation, type-safe env (`src/env.ts`)                                                                                                                                                             |
| **Settings**        | Profile, password, preferences (theme/language), danger zone                                                                                                                                                                                                                                                                                      |
| **Taxonomy**        | Shared 3-level master taxonomy (Category → Sub-category → Service Area, 14 categories, coded), used by elements, vendors, BOQ, RFQs, rate contracts; starter-set seeding; category management on /vendors                                                                                                                                         |
| **Element Library** | Element CRUD with cost build-up, service-area classification, library → BOQ default-flow                                                                                                                                                                                                                                                          |
| **BOQ**             | Sections + per-section totals, item drawer, cost build-up (overhead / service-charge / margin), client rate & budget rate, source provenance, contingency & VAT, Excel import/export round-trip, phase lifecycle (draft → client-approved → ready-for-procurement), immutable item-change versioning                                              |
| **Vendor Mgmt**     | Vendor master (code, legal name, contacts, tax/GSTIN, website, rating, preferred), service-area mapping via shared taxonomy, KYC + bank tabs, Rate Contracts tab                                                                                                                                                                                  |
| **Rate Contracts**  | Full lifecycle (draft → under-review → approved → active → suspended/closed/expired/cancelled) + approval, contract items by service area (+ optional element), commercial terms, apply-rate to BOQ                                                                                                                                               |
| **RFQ & Quotes**    | Procurement packages (multi-item, multi-vendor), service-area vendor suggestion, issue/invite (email fan-out), vendor portal submit/revise, manual & multi-channel quote entry + evidence, quote versioning, comparison matrix, single + split award, RFQ revisions (supersede), scope-change impact routing, communication timeline, audit trail |

---

## Not Yet Built

**High:** Purchase Orders + Change Orders, Inter-org task collaboration, design sections & tags, RFIs, reporting dashboard

**Medium:** Progress tracking / vendor-wise scope, WBS / activity schedule, Gantt chart scheduling, snaglist / punch list, quality audits

**Low:** Field operations, mobile app (PWA), live email/WhatsApp integration (OCR, auto-reminders, AI vendor recommendation)

> **RFQ module Phase 2 (planned, not started):** partial per-item bidding, quote evidence metadata, RFQ distribution tracking, comparison decision criteria — see `docs/rfq-gap-closure-phase2-plan.md`.

---

## Architecture

|              |                                            |
| ------------ | ------------------------------------------ |
| Framework    | Next.js 16 (App Router) + React 19         |
| Styling      | Tailwind CSS v4                            |
| PDF          | `pdfjs-dist` with local worker             |
| Auth         | Better Auth (email/password + org plugin)  |
| DB + Storage | Supabase (Postgres via `pg` pool, Storage) |
| Email        | Brevo SMTP (nodemailer)                    |
| i18n         | `next-intl` (EN + TR)                      |
| DnD          | `@dnd-kit/core` + `@dnd-kit/sortable`      |
| Env          | Zod-validated (`src/env.ts`)               |

---

## Key Technical Decisions

- **ReviewPanel absolutely positioned** — prevents PDF viewer zoom oscillation from flex resizing.
- **Org role via member table** — never trust `session.user.role`; query via `getOrgRole()`.
- **Unified routes** — no separate `(client)` group; all pages adapt via `useUserRole` hook.
- **Lightbox via `createPortal`** — z-[200] on `document.body` to escape Radix Dialog focus trap.
- **CSRF fail-closed** — rejects missing `origin`/`host`, not just mismatch.
- **Type-safe env** — all `process.env` through Zod-validated `src/env.ts`. Zero raw access in src/.
- **Proxy-file SSRF** — hostname restricted to `NEXT_PUBLIC_SUPABASE_URL`, streaming with byte counter.
