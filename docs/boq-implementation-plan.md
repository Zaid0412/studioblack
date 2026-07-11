# ArchBuild Implementation Plan

## Implementation status (audited 2026-07-11)

**Verified against the actual codebase** (tables, queries, routes, UI) — not the
prose below, which is written in the original spec/future tense and does NOT
reflect what has shipped. This table is the source of truth for status.

Legend: ✅ shipped · 🟡 partial / diverged · ❌ not built

| Feature                          | Status | Notes                                                                                                                |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| F1 Element Categories            | ✅     |                                                                                                                      |
| F2 Element Library CRUD          | ✅     |                                                                                                                      |
| F3 Element Excel Import/Export   | ✅     |                                                                                                                      |
| F4 BOQ Core                      | ✅     | Diverged: a single `phase` lifecycle replaced the planned two-track `lifecycle_status` + `client_approval_status`    |
| F5 BOQ UI                        | ✅     |                                                                                                                      |
| F6 BOQ Excel Import/Export       | ✅     |                                                                                                                      |
| F6.1 BOQ Table Enhancements      | ✅     | Shipped PR #81 (2026-04-29)                                                                                          |
| F7 Vendor Management             | ✅     |                                                                                                                      |
| F7.1 Vendor Tax ID + KYC         | ✅     |                                                                                                                      |
| F7.5 Rate Contracts              | ✅     |                                                                                                                      |
| F8 Vendor Role + Portal          | ✅     | Core shipped; PO / invoices / progress sub-pages are placeholders pending F14/F15/F16                                |
| F8.5 Vendor Self-Service Profile | ✅     |                                                                                                                      |
| F9 RFQ Workflow                  | ✅     | Incl. versioning, invite, revise, cancel, split scope                                                                |
| F10 Vendor Quotes                | ✅     | Incl. comparison, award, split-award, offline entry                                                                  |
| F11 Client Proposals             | ❌     |                                                                                                                      |
| F12 Client BOQ Portal            | 🟡     | Client scope view + cost-scrub only; no proposals/orders/invoices sub-nav                                            |
| F13 BOQ Locking + Change Orders  | 🟡     | Lighter per-item change-request flow (`change_requested`/`superseded` phases); no formal Change Orders or lock route |
| F14 Purchase Orders              | ❌     |                                                                                                                      |
| F14.5 Compare BOQ vs Order       | ❌     | Depends on F14                                                                                                       |
| F15 Vendor Invoices              | ❌     |                                                                                                                      |
| F16 Progress Tracking            | 🟡     | Only an `installed_qty` column; no progress API/UI                                                                   |
| F16.5 Vendor-Wise Scope          | ❌     |                                                                                                                      |
| F16.6 Vendor DPR                 | ❌     |                                                                                                                      |
| F17 Snag Management              | ❌     | Only a `has_snag` column                                                                                             |
| F18 BOQ Dashboard Widgets        | 🟡     | BOQ review stats only; no charts / margin / PO / snag widgets                                                        |
| F19 PDF Export                   | 🟡     | BOQ email PDF only; no client-facing export, proposal, PO, or CO PDFs                                                |
| F20 Custom Tabs                  | ❌     |                                                                                                                      |
| F21 Audit Trail                  | 🟡     | `boq_item_version` + generic `audit_event` instead of the planned `boq_change_log`                                   |
| F22 Client Invoices              | ❌     |                                                                                                                      |
| F23 Client Payments              | ❌     |                                                                                                                      |
| F24 Client Orders View           | ❌     |                                                                                                                      |

**Tally: 14 shipped · 6 partial · 11 not built.** The pipeline is built through
F10 (quote award); everything downstream of awarding — proposals, POs, invoices,
change orders, progress, snags, client billing — is unbuilt or stub.

**Built but not in this plan** (bonus scope): the internal-review workflow
(`pending_internal_review → internally_approved → submitted_to_client`), BOQ item
phases + dimensions, element media/versioning, vendor multi-address + rating, RFQ
item attachments / proposed price, and a full Project Documents module.

**Project-tab reality:** the app ships 3 tabs (`designs` / `boq` / `order`, with
RFQs nested under Order), not the 8-tab bar this plan describes.

> **Source PRD** (Google Docs — 6 tabs):
>
> - [Tab 1 — Overview & Architecture](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.0)
> - [Tab 2 — Database Schema & Permissions](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.kxk5xif02yog)
> - [Tab 3 — UI Specs & Workflows](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.l1rfcv6wiy3h)
> - [Tab 4 — Error Handling & Phase 2](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.awk8tpqx406u)
> - [Tab 5 — Client BOQ Sub-Nav (informal)](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.a3ma4anbiwbv)
> - [Tab 6 — Operational Logic & State Machines](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.ts167vyji3xt)
>
> **Addendum tabs** (added after the plan — see "Revisions from PRD Tabs 7–10"):
>
> - [Construction Category Structure](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.qvk7mq2iegty)
> - [Price Terminology (multi-stage pricing)](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.e92hrz2qe5w1)
> - [RFQ & Vendor Management FRD](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.xa6xrobksshj)
> - [Vendor Master Taxonomy](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.ahdn7rk1bmeb)
>
> **Later tabs** (added after the addendum — RFQ / rate-contract / procurement material; tab names are the doc's current labels):
>
> - [RFQ - NEW](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.tb2wrtgb4f1f)
> - [RFQ - detailed REQ New](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.wt5zwx8zv889)
> - [Vendor-cat/sub/service (current taxonomy)](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.byxoydqtjbd3)
> - [Rate contract](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.csq1hgbovm1)
> - [PO/Invoice](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.gpgps6teep6q)
> - [Awards & PO](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.xs6yeduybzkk)

## Overview

Transform StudioBlack (design review platform) into ArchBuild (BOQ-centric construction management platform). Each feature is a self-contained PR that ships to production independently.

**Current state**: Next.js 16, React 19, better-auth, raw SQL via `pg`, 3 roles (PM/Architect/Client), design review workflow, tasks, notifications.

**Target state**: Everything above PLUS Element Library, BOQ, Vendor Management, RFQ/Quotes, Client Proposals, Purchase Orders, Change Orders, Progress Tracking, and Client BOQ Portal.

---

## Revisions from PRD Tabs 5–6

Tabs 5 (client BOQ sub-nav) and 6 (end-to-end operational logic + state machines) were added after the initial plan. They are additive / refining — nothing below is invalidated. Net changes are folded into the relevant features and summarised here.

### New features

- **F22 — Client Invoices** (new). Org → client billing. Separate from F15, which stays scoped to vendor invoices.
- **F23 — Client Payments** (new). Payments received from the client against F22 invoices. Tab 5 calls this "Payment from client".
- **F24 — Client Orders view** (new). Read-only client surface listing approved BOQ items as an order log. No new DB — derived from F12 data.

### Changes to existing features

- **F4** — hard-block edits on items whose `client_approval_status = 'approved'` (tab 6 Rule 3). The current auto-flip to `requires_reapproval = true` is pending review — see Open decisions.
- **F12** — client BOQ sub-nav becomes **Scope · Proposals · Orders · Client Invoices · Payments** (tab 5). Change Orders and Progress are no longer top-level client tabs; clients see them via notifications and inline badges on BOQ items.
- **F13** — CO implementation bumps `boq.version` and writes `boq.snapshot` before applying changes (tab 6 Rule 4). Previously only the lock step snapshotted.
- **F14** — reject `POST /purchase-orders` if any referenced `boq_item.client_approval_status ≠ 'approved'` (tab 6 Rule 1). Same gate on PATCH when items are swapped in.
- **F15** — scoped to vendor invoices only. Client-facing invoice routes move to F22. Same approval gate applies: no vendor invoice for unapproved BOQ scope (tab 6 Rule 2).

### Tab 6 rules — enforcement map

| Rule                                       | Enforced in                                                        |
| ------------------------------------------ | ------------------------------------------------------------------ |
| 1. No PO without approval                  | F14 server guard                                                   |
| 2. No invoice on unapproved items          | F15 (vendor) + F22 (client) server guards                          |
| 3. Post-approval changes → CO              | F4 block, F13 CO flow (pending decision)                           |
| 4. Never overwrite BOQ — always version    | F13 bumps `boq.version` + snapshot on CO implement                 |
| 5. Vendor cost ≠ client price              | F4 schema already separates `unit_cost` from computed `sell_price` |
| Core: every action references a `boq_item` | Already honoured across F9 / F13 / F14 / F17 / F22                 |

### Open decisions (not yet answered)

- **Rule 3 strictness.** F4 today silently re-flags approved items. Tab 6 wants a hard 409 with "raise a change order". Recommended: hard block. Confirm before hardening F4.
- **Rule 4 frequency.** Snapshot + bump `boq.version` on every CO implement (recommended) vs. on every approval boundary (aggressive) vs. only at lock (status quo).
- **BOQ item lifecycle breadth.** Tab 6 lists Draft → Priced → Sent → Approved/Rejected → Ordered → In Progress → Completed → Invoiced. Current `lifecycle_status` CHECK omits Priced / Ordered / In Progress / Completed / Invoiced — those are derived from `unit_cost`, `po_status`, `installed_qty`, invoice link. Recommended: keep derived, add `getDisplayStatus()` helper in `queries/boq.ts` for a unified badge.

---

## Revisions from PRD Tabs 7–10

Four further PRD tabs (Construction Category Structure, Price Terminology, the RFQ & Vendor Management FRD, and the Vendor Master Taxonomy) surfaced after the plan was written. Most of their content is already in the plan (RFQ↔BOQ, line items, split/partial award, quote comparison, PO-from-quotes, vendor master/contacts/categories, client proposals/approval, email RFQ). The items below are **net-new — not reflected anywhere else in this plan** — and two of them **conflict with the shipped design** (see Open decisions). Nothing already built or specced is invalidated.

### New requirements (not yet in the plan)

- **Vendor Type (multi-select)** — classify each vendor as one or more of: Material Supplier, Labor Contractor, Equipment Vendor, Subcontractor, Manufacturer, Distributor. Distinct from trade category. No such field exists on `vendor` today. (FRD §6.1.)
- **RFQ cost-types** — an RFQ carries one or more of Material / Labor / Equipment / Subcontract / Other, so a single BOQ item can spawn a material-only RFQ, a labor-only RFQ, etc. The current `rfq` schema (F9) has no type classification. (FRD §3.)
- **Manual / offline quote entry + Response Source** — the FRD stresses that many vendors won't use the portal. The system must let a PM record a vendor response received via Email / Phone / WhatsApp, and every quote must store its **Response Source** (Portal / Email / Phone / WhatsApp / Manual). F10 today assumes portal-only vendor submission. (FRD §7–8.)
- **RFQ versioning** — when a design change forces a re-quote, capture `rfq_version`, `revision_notes`, and a `parent_rfq` link rather than mutating the original. Not in F9. (FRD §10.)
- **Multi-stage price ladder + price-history table** — track the commercial value through named, never-overwritten stages: Base Cost → Proposed Price → Quoted Price → Approved Price → PO Price → Invoice Price → Final Price, persisted in a price-history table for margin-bleed / scope-creep / vendor-inflation / client-revision analysis. The plan tracks these prices _across_ features (`unit_cost`, computed `sell_price`, quote, PO, invoice) but has no unified ladder or history table; F21 audit is generic. "Proposed Price" is the chosen primary client-facing label (already in use). (Price Terminology tab.)
- **Work Order (WO)** — a distinct execution document for labor / subcontract, kept separate from the PO (procurement). The doc recommends PO now, WO later; do **not** merge the two types. Plan has POs (F14) only. (FRD §13.)
- **Minor:** RFQ line-item **Preferred Brand** field; the recommended **17-category interior seed set** (Preliminaries, Civil & Structural, Masonry & Plaster, Flooring & Tiling, Ceilings, Doors/Windows/Glazing, Joinery & Carpentry, Finishes, Kitchen & Utility, Wardrobes & Storage, Electrical, Lighting, Plumbing & Sanitary, HVAC, Fire & Safety, FF&E, External Works); optional **smart tags** (luxury / budget / premium / eco-friendly).

### Changes to existing features

- **F7 (Vendor Management)** — add `vendor_type` (multi-select) to the vendor master + form + list filter. Add RFQ line-item `preferred_brand` where vendors are matched.
- **F9 (RFQ Workflow)** — add RFQ **cost-types** (multi-select) and **versioning** (`rfq_version`, `revision_notes`, `parent_rfq_id`).
- **F10 (Vendor Quotes)** — add **manual/offline quote entry** path (PM-entered) and a `response_source` column on `vendor_quote`; relax the portal-only assumption.
- **New feature (future) — Work Orders (WO)** — labor/subcontract execution document parallel to POs (F14). Deferred per the FRD; slot after the PO/Progress features.
- **Pricing** — either formalise the named price ladder + `price_history` table as a cross-cutting concern, or confirm the current per-feature columns + F21 audit are sufficient (see Open decisions).

### Already covered (no action)

Split / partial vendor allocation (F10 "Split award"), quote comparison table, PO from awarded quotes (F14), vendor contacts, vendor↔category mapping, service-area-as-text + brands + preferred flag (F7, shipped), client proposals & per-item approval (F11/F12), email RFQ notification with portal deep link (F9).

### Open decisions (not yet answered)

- **Vendor taxonomy — shared vs separate.** The Vendor Master Taxonomy tab proposes a _separate_ vendor classification system (`vendor_categories`, `vendor_subcategories`, `vendor_service_areas` + mapping tables, with category codes like JOIN / FLR / FIN). The plan and the **shipped code** instead reuse the `element_category` tree via `vendor_trade`. These are mutually exclusive — pick one before any taxonomy work. ⚠️ Conflicts with shipped design.
- **Service Area — text vs structured.** The FRD (§6.3) says Service Area is a free-text field — matches the shipped `vendor.service_areas TEXT[]`. The Vendor Master Taxonomy tab says it should be a structured `vendor_service_areas` table. The PRD contradicts itself; resolve alongside the taxonomy decision.

---

## Key Architecture Decisions

### What stays the same

- **Next.js App Router** — no migration to Vite/SPA (PRD assumes greenfield React+Vite; we already have Next.js)
- **better-auth** — no migration to Supabase Auth (our auth is mature, tested, works)
- **Raw SQL via `pg`** — no PostgREST, no ORM (matches existing patterns in `queries.ts`)
- **SWR** — no migration to TanStack Query (we already use SWR globally)
- **Existing UI components** — shadcn pattern already in place, reuse everything

### What the PRD says vs what we do

| PRD says              | We do instead                                   | Why                                                    |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Supabase Auth + RLS   | better-auth + `withAuth()`                      | Already built, tested, 40+ routes use it               |
| TanStack Query v5     | SWR                                             | Already configured globally, same purpose              |
| Supabase Realtime     | SWR polling + `usePageVisibility()`             | Already have the pattern; add Realtime later if needed |
| Vercel Edge Functions | Next.js API Routes                              | Same hosting, simpler                                  |
| React Hook Form       | Continue with current form patterns             | Add RHF only if forms get complex enough to justify it |
| TanStack Table v8     | Add for BOQ table (new dependency)              | Justified — BOQ needs virtualisation for 1000+ rows    |
| Recharts              | Add when needed (Phase 3+)                      | Not needed until dashboard charts                      |
| React-PDF             | Add when needed (Phase 3+)                      | Not needed until PDF export                            |
| SheetJS (xlsx)        | Add for Element Library import (new dependency) | Justified — Excel import is core feature               |
| TipTap                | Evaluate when needed                            | Rich text only needed for custom tabs (late feature)   |

### New role: Vendor

- Add `vendor` to `UserRole` type
- Add `vendor` role to better-auth org plugin
- Add vendor-specific nav items to sidebar
- Vendor access is RFQ-scoped (not project-scoped like architect/client)
- Implemented in Feature 7 (Vendor Management) — not before

### Deferred decisions (not needed now, revisit later)

**Super Admin role** — The PRD defines a platform-level Super Admin with cross-org access. For now, PM (org owner/admin) is sufficient since the app is single-org scoped. If multi-org or platform administration becomes needed, add a `super_admin` role with a separate admin panel that bypasses org scoping. The current `withAuth()` architecture supports this — just add the role to `allowedRoles` arrays.

**Threaded messaging** — The PRD's client portal spec includes "Threaded messaging per project between client and architect." The existing `CommentsSection` (flat project-level comments) is sufficient for now. If richer client-architect communication is needed later, upgrade to a threaded model: add `parent_id` to comments (same pattern as pin comment replies), group into threads, add unread tracking. The DB schema change is minimal — the UI is the main work.

---

## UX Integration — How New Features Connect to the Existing App

This section maps every new module to the existing UX surfaces. Nothing is orphaned — every feature has a clear entry point from the current UI.

### Current App Structure (what users see today)

```
SIDEBAR (desktop)                    MOBILE BOTTOM NAV
├── Dashboard                        ├── Dashboard
├── Projects                         ├── Projects
├── Tasks                            ├── Tasks
├── Organisation (PM only)           └── Audit
├── Settings
└── Audit (PM only)

PROJECT DETAIL PAGE (single scrollable page)
├── ProjectHeader (breadcrumb + name + refresh)
├── MetaBar (client, architects, created, location, scope, area, estimate)
├── WorkflowBar (Edit Project + Upload Designs buttons — PM only)
├── PendingTasksBanner (client only)
├── CompletedBanner (client + completed status)
├── PhaseTabs (6 design phases: 2D Layout, 3D Layout, etc.)
├── FileTable (design files per phase, with review status)
├── TaskSection (tasks filtered by active phase — PM/architect only)
├── ApprovalHistory (client only)
└── CommentsSection (project-level comments)
```

### How the new modules integrate

#### 1. Sidebar Changes

The sidebar currently has 3 nav variants: `pmNav`, `architectNav`, `clientNav`. We add a 4th (`vendorNav`) and extend the existing ones:

```
PM / ARCHITECT SIDEBAR (new items marked with +)
├── Dashboard
├── Projects
├── Tasks
├── + Elements          ← NEW top-level page (Feature 2)
├── + Vendors           ← NEW top-level page (Feature 7)
├── Organisation
├── Settings
└── Audit

CLIENT SIDEBAR (unchanged — all new client features are within project detail)
├── Dashboard
├── Projects
└── Settings

VENDOR SIDEBAR (entirely new — Feature 8)
├── Dashboard           ← vendor-specific: open RFQs, active POs
├── RFQs               ← RFQs assigned to this vendor
├── Purchase Orders     ← POs issued to this vendor
└── Settings
```

**Elements** and **Vendors** are global (not project-scoped) — they live in the sidebar alongside Projects and Tasks. Gated behind feature flags.

**Mobile bottom nav** — add Elements icon (Layers/Blocks) when `features.elementLibrary` is on. Vendors stays desktop-only (less frequently accessed on mobile).

#### 2. Project Detail Page — The Big Change

The current project detail is a single scrollable page with PhaseTabs → FileTable → Tasks → Comments. The new features add **project-level tabs** above the current content, turning it into a multi-section view:

```
PROJECT DETAIL PAGE (after all features)
├── ProjectHeader (unchanged)
├── MetaBar (unchanged)
├── WorkflowBar (extended — see below)
│
├── PROJECT TABS (NEW — horizontal tab bar)          ← This is the key UX addition
│   ├── Designs      ← current content (PhaseTabs + FileTable + Tasks)
│   ├── BOQ          ← Feature 5 — full BOQ page
│   ├── RFQs         ← Feature 9 — RFQ list and management
│   ├── Proposals    ← Feature 11 — client proposals
│   ├── POs          ← Feature 14 — purchase orders
│   ├── Change Orders← Feature 13
│   ├── Progress     ← Feature 16
│   ├── Snags        ← Feature 17
│   └── [Custom Tabs]← Feature 20 — user-created tabs
│
├── CommentsSection (unchanged — always visible below tabs)
└── (Client variant shows filtered subset of tabs)
```

**Implementation**: A new `ProjectTabs` component wraps the tab content. The current page content (PhaseTabs + FileTable + TaskSection) becomes the "Designs" tab. Each new feature adds its tab content incrementally. Tabs that don't have their feature flag enabled simply don't render.

**When each tab appears**:

- Feature 4+5: BOQ tab appears
- Feature 9: RFQs tab appears
- Feature 11: Proposals tab appears
- Feature 13: Change Orders tab appears
- Feature 14: POs tab appears
- Feature 16: Progress tab appears
- Feature 17: Snags tab appears
- Feature 20: Custom tabs appear

Before Feature 5, the project page looks exactly as it does today. After Feature 5, a tab bar appears and the current content shifts under the "Designs" tab.

#### 3. WorkflowBar Evolution

Currently: `Edit Project` + `Upload Designs` buttons.

After features are added:

```
WorkflowBar (PM/Architect, adapts to active tab)
├── Designs tab active:  Edit Project | Upload Designs (current)
├── BOQ tab active:      Add Section | Add Item | Import Excel | Export | Issue to Client | Lock BOQ
├── RFQs tab active:     Create RFQ
├── Proposals tab active: Create Proposal
├── POs tab active:      Create PO
├── Change Orders active: Create Change Order
├── Snags tab active:    Report Snag
```

The WorkflowBar becomes **context-aware** — it renders different action buttons depending on which project tab is active. This is a clean extension of the existing pattern.

#### 4. Dashboard Evolution

**Current PM/Architect dashboard**: 4 stat cards (Active Projects, Pending Reviews, Approved Designs, Team Members) + Recent Activity + Upcoming Deadlines.

**After BOQ features** (Feature 18):

```
PM/ARCHITECT DASHBOARD
├── Stats row (extended)
│   ├── Active Projects (existing)
│   ├── Pending Reviews (existing)
│   ├── + Open BOQ Items           ← total BOQ items pending client approval
│   ├── + Margin Alerts            ← items below threshold
│   └── Team Members (existing)
│
├── Recent Activity (extended to include BOQ/RFQ/PO events)
│
├── + BOQ Overview card            ← total value across all projects, progress %
├── + Margin Bleed widget          ← top 5 items below margin threshold
│
└── Upcoming Deadlines (extended to include RFQ deadlines, PO delivery dates)
```

**Current client dashboard**: 3 stats (Total Projects, Pending Review, Reviewed) + Project cards.

**After client BOQ portal** (Feature 12):

```
CLIENT DASHBOARD
├── Stats row (extended)
│   ├── Total Projects (existing)
│   ├── Pending Review (existing → includes BOQ items pending approval)
│   ├── Reviewed (existing)
│   └── + Pending Change Orders    ← COs awaiting client decision
│
├── + Outstanding Approvals card   ← BOQ items + proposals + COs awaiting action
│
└── My Projects (existing, unchanged)
```

#### 5. Client Portal — Inside Project Detail

The client already sees a filtered version of the project detail page (no TaskSection, no WorkflowBar, shows PendingTasksBanner + ApprovalHistory). The new features extend this:

```
CLIENT PROJECT DETAIL (after all features)
├── ProjectHeader (unchanged)
├── MetaBar (client variant — unchanged)
├── PendingTasksBanner (existing)
│
├── PROJECT TABS (client sees filtered subset)
│   ├── Designs      ← existing (read-only file table)
│   ├── Scope (BOQ)  ← Feature 12 — filtered BOQ (no costs, only sell prices)
│   │                  Approve/Reject/Query per item
│   ├── Proposals    ← Feature 11 — view PDF, approve, reject, sign
│   ├── Change Orders← Feature 13 — approve/reject COs
│   ├── Progress     ← Feature 16 — read-only progress view
│   └── Documents    ← existing file access, repackaged as a tab
│
├── ApprovalHistory (extended to include BOQ + CO approvals)
└── CommentsSection (unchanged)
```

Key: client NEVER sees cost data, margins, overheads, vendor info, RFQs, or internal notes. The `client_approval_status` fields on BOQ items are the only thing the client interacts with.

#### 6. Vendor Portal — Entirely New Section

Vendors access the app through the same login but get a completely different shell:

```
VENDOR PORTAL (Feature 8+)
├── Sidebar: vendorNav (Dashboard, RFQs, POs, Settings)
│
├── /dashboard
│   ├── Open RFQs count
│   ├── Active POs count
│   ├── Pending quotes
│   └── Recent activity
│
├── /rfqs           ← RFQs assigned to this vendor
│   └── /rfqs/[rfqId]            ← Quote submission form
│
├── /purchase-orders ← POs issued to this vendor
│   └── /purchase-orders/[poId]   ← PO detail + acknowledge button
│
└── /settings                      ← shared settings page
```

Vendors never see the main project list, elements, or any architect-facing UI.

#### 7. Element Library — Standalone Page

The Element Library is a **global resource** (not project-scoped). It lives at `/elements` with its own sidebar nav item.

```
/elements
├── LEFT PANEL (30%): CategoryTree
│   ├── Structural Works
│   │   ├── Concrete Works
│   │   │   ├── Reinforced Concrete Slabs ← click to filter
│   │   │   └── ...
│   │   └── Steel Works
│   └── ...
│
├── RIGHT PANEL (70%): Element Table
│   ├── Search bar + filter chips + Import/Export/Add buttons
│   ├── Table (Code, Name, Category badge, Unit, Unit Cost, Margin%, Tags, Status, Actions)
│   └── Click row → Element detail drawer (side sheet)
```

**Connection to BOQ**: When adding items to a BOQ (Feature 5), there's an "Add from Library" button that opens an Element Picker dialog — essentially a mini version of the Element Library embedded in the BOQ page. Selecting an element auto-fills the BOQ item with the element's defaults (unit, cost, margin, description).

#### 8. BOQ Table — The Core New UI

The BOQ lives as a tab within the project detail page:

```
/projects/[id]  →  BOQ tab
├── Summary Cards (Total Cost, Sell Price, Margin%, Pending Approvals, Margin Bleed)
│
├── BOQ Table (TanStack Table, virtualised)
│   ├── Section: Structural Works (collapsible)
│   │   ├── STR-001  Reinforced Concrete Slab  m²  120  $45.00  $5,400  12%  $6,773  Pending  ...
│   │   ├── STR-002  Steel Reinforcement        kg   800  $2.50   $2,000  15%  $2,645  Approved ...
│   │   └── Section total: $8,073 sell / $7,400 cost
│   ├── Section: MEP (collapsible)
│   │   └── ...
│   └── Grand total row
│
├── Bottom Bar (Subtotal → Contingency → Pre-VAT → VAT → Client Total)
│
└── Right Drawer (item detail — opens on row click)
    ├── Full item info
    ├── Element library link (if sourced from library)
    ├── Cost breakdown
    ├── Client approval status + history
    ├── PO status
    ├── Progress (installed qty)
    └── Linked snags
```

**Inline editing**: Quantity, Unit Cost, Margin %, Description are editable directly in the table. Changes save on blur.

#### 9. Cross-Module Navigation (How Everything Links Together)

These are the "connective tissue" links between modules:

| From                       | To                                    | Trigger                                             |
| -------------------------- | ------------------------------------- | --------------------------------------------------- |
| Element Library → BOQ      | "Add to BOQ" action on element        | Creates BOQ item from element                       |
| BOQ item → Element Library | "View in Library" link in item drawer | Opens element detail                                |
| BOQ item → RFQ             | "Add to RFQ" action column            | Opens RFQ creation with item pre-selected           |
| RFQ → Vendor               | "Suggested Vendors" panel             | Links to vendor profiles                            |
| RFQ → Vendor Quote         | "View Quotes" on RFQ detail           | Opens quote comparison                              |
| Quote → PO                 | "Create PO" after award               | Auto-populates PO from quote                        |
| BOQ item → Change Order    | "Raise CO" when item is locked        | Opens CO creation                                   |
| Change Order → BOQ         | "Implement" action                    | Applies changes to BOQ                              |
| BOQ item → Snag            | "Report Snag" action                  | Creates snag linked to item                         |
| Snag → BOQ item            | "View BOQ item" link in snag          | Navigates to item in BOQ table                      |
| Dashboard → BOQ            | "Margin Bleed" widget                 | Links to specific project's BOQ                     |
| Notification → Project tab | Notification click                    | Deep-links to specific tab (BOQ approval, CO, etc.) |
| Client approval → BOQ item | Approve/reject in client portal       | Updates item status                                 |

#### 10. Notification System Extension

Current notification types: review, comment, approval, upload, deadline, team, invitation, task_assigned, review_requested, review_submitted.

New notification types added incrementally:

```
Feature 4:  boq_submitted        — "BOQ for [project] was issued to client"
Feature 9:  rfq_issued           — "New RFQ received: [title]" (to vendor)
Feature 10: quote_received       — "Vendor [name] submitted a quote for [RFQ]"
Feature 11: proposal_sent        — "Proposal sent for [project]"
            proposal_approved    — "Client approved proposal for [project]"
            proposal_rejected    — "Client rejected proposal for [project]"
Feature 12: boq_item_approved    — "Client approved [X] BOQ items"
            boq_item_rejected    — "Client rejected BOQ item: [description]"
            boq_item_queried     — "Client has a query on: [description]"
Feature 13: change_order_submitted — "Change order CO-001 sent for approval"
            change_order_approved  — "Client approved change order CO-001"
            change_order_rejected  — "Client rejected change order CO-001"
Feature 14: po_issued            — "PO issued to [vendor]" (to vendor)
            po_acknowledged      — "[Vendor] acknowledged PO-001"
Feature 17: snag_reported        — "Snag reported on [BOQ item]"
            snag_resolved        — "Snag resolved: [title]"
```

All use the existing `notification` table and `useNotifications` hook. No new infrastructure needed — just new notification `type` values and corresponding icons/colors in `activityConstants.ts`.

#### 11. Existing Feature Connections (What Stays, What Evolves)

| Existing Feature                                   | What Happens to It                                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design Review (upload → review → approve → freeze) | **Stays exactly as-is**. Becomes the "Designs" tab in project tabs.                                                                                                                                              |
| Pin Comments + Annotations                         | **Stays as-is**. Design review workspace unchanged.                                                                                                                                                              |
| Tasks                                              | **Stays as-is** + gains BOQ item linking. Tasks can now be auto-created from BOQ rejections (like pin→task today).                                                                                               |
| Comments (project-level)                           | **Stays as-is**. Always visible below the project tabs.                                                                                                                                                          |
| Approval History (client)                          | **Extended**. Shows BOQ approvals and CO decisions alongside design approvals.                                                                                                                                   |
| File versioning                                    | **Stays as-is**. Design files continue using version_group pattern.                                                                                                                                              |
| Organisation management                            | **Extended**. Vendor invitations use the same org invitation flow.                                                                                                                                               |
| Settings page                                      | **Extended**. Vendors get a settings page too.                                                                                                                                                                   |
| Audit history                                      | **Extended**. Gains BOQ change log entries alongside existing audit events.                                                                                                                                      |
| `PROJECT_STEPS` workflow bar                       | **Kept but may become secondary**. The 7 steps (Recce → Design → BOQ → Order → Work Progress → Snag → Finance) map naturally to the new modules. Consider evolving this into a project-level progress indicator. |

#### 12. Data Flow: From Element to Client Invoice

The full lifecycle through the system:

```
1. Architect creates ELEMENTS in the library (global, reusable)
                    ↓
2. Architect creates a BOQ for a project, adds items FROM elements
                    ↓
3. BOQ is issued to CLIENT for scope approval (item by item)
                    ↓
4. Client APPROVES/REJECTS/QUERIES items → BOQ is locked when all approved
                    ↓
5. Architect creates RFQs from BOQ items → sends to VENDORS
                    ↓
6. Vendors submit QUOTES → Architect compares → Awards winner
                    ↓
7. Architect generates CLIENT PROPOSAL from awarded quotes (with markup)
                    ↓
8. Client approves proposal → PURCHASE ORDER auto-created from awarded quote
                    ↓
9. Vendor acknowledges PO → delivers → DELIVERY tracked on PO items
                    ↓
10. Any scope changes after lock → CHANGE ORDER workflow → client approval → BOQ updated
                    ↓
11. PROGRESS tracked against BOQ items (installed qty)
                    ↓
12. SNAGS reported against BOQ items → resolved
                    ↓
13. Vendor submits INVOICES against POs → approved/paid
```

Every step is visible in the project detail page under its respective tab.

---

## Feature Sequence

Each feature is a standalone PR. Dependencies flow downward — no feature depends on anything below it.

```
Feature 1:  Element Categories (DB + API + UI)
Feature 2:  Element Library CRUD (DB + API + UI)
Feature 3:  Element Excel Import/Export
Feature 4:  BOQ Core (DB + API — create/read/update BOQ + sections + items)
Feature 5:  BOQ UI (page, table with TanStack Table, inline editing, cost calculations)
Feature 6:  BOQ Excel Import/Export
Feature 7:  Vendor Management (DB + API + UI — vendor CRUD, contacts, trades)
Feature 8:  Vendor Role + Portal (auth role, sidebar, vendor-facing pages)
Feature 8.5: Vendor Self-Service Profile (vendor edits own bank/KYC/contacts)
Feature 9:  RFQ Workflow (DB + API + UI — create RFQ, issue to vendors)
Feature 10: Vendor Quotes (DB + API + UI — quote submission, comparison table)
Feature 11: Client Proposals (DB + API + UI — generate from quotes, send to client)
Feature 12: Client BOQ Portal (extend existing client portal — BOQ view, item approval)
Feature 13: BOQ Locking + Change Orders (DB + API + UI — lock flow, CO workflow)
Feature 14: Purchase Orders (DB + API + UI — PO from awarded quotes)
Feature 15: Invoices (DB + API + UI — invoice tracking against POs)
Feature 16: Progress Tracking (installed qty on BOQ items, progress bars)
Feature 17: Snag Management (link snags to BOQ items)
Feature 18: BOQ Dashboard Widgets (margin bleed, budget alerts, progress overview)
Feature 19: PDF Export (BOQ, proposals, POs, change orders)
Feature 20: Custom Tabs (rich text, table, document, timeline, Q&A per project)
Feature 21: Audit Trail (boq_change_log — full history of all BOQ mutations)
Feature 22: Client Invoices (DB + API + UI — org → client billing)
Feature 23: Client Payments (DB + API + UI — payments received from client)
Feature 24: Client Orders view (UI — approved BOQ items as client order log)
```

---

## Feature Details

---

### Feature 1: Element Categories

**Goal**: Three-level category tree for organising construction elements.

**Database** — new migration `scripts/migrate-element-categories.sql`:

```sql
CREATE TABLE element_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  parent_id UUID REFERENCES element_category(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  code_prefix VARCHAR(10),
  sort_order INTEGER DEFAULT 0,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_element_category_parent ON element_category(parent_id);
CREATE INDEX idx_element_category_level ON element_category(level);
```

**Queries** — add to `queries.ts`:

- `getCategoryTree()` — recursive CTE returning nested tree
- `getCategoryById(id)`
- `createCategory(input)` — validate parent level (parent level must be < 3)
- `updateCategory(id, input)`
- `deleteCategory(id)` — check for child categories and elements first
- `reorderCategories(parentId, orderedIds)`

**API Routes**:

- `GET /api/element-categories` — returns full tree
- `POST /api/element-categories` — create category
- `PATCH /api/element-categories/[id]` — update
- `DELETE /api/element-categories/[id]` — delete (fails if has children or elements)
- `PATCH /api/element-categories/reorder` — reorder within parent

**UI**:

- No standalone page yet — the category tree UI will be the left panel of the Element Library page (Feature 2)
- Build the `CategoryTree` component as a reusable component in `src/components/elements/CategoryTree.tsx`
- Collapsible tree with drag-to-reorder
- Inline add/edit/delete actions
- Color badge per category

**Auth**: `allowedRoles: ["pm", "architect"]`

**Feature flag**: Add `elementLibrary: false` to `features.ts` — toggle on when ready

**Tests**:

- API route tests for CRUD + validation (level constraints, delete with children)
- Unit tests for tree building logic

**Files to create/modify**:

- `scripts/migrate-element-categories.sql` (new)
- `src/lib/queries.ts` (add ~100 lines)
- `src/app/api/element-categories/route.ts` (new)
- `src/app/api/element-categories/[id]/route.ts` (new)
- `src/app/api/element-categories/reorder/route.ts` (new)
- `src/components/elements/CategoryTree.tsx` (new)
- `src/config/features.ts` (add flag)
- `src/types/index.ts` (add types)
- `src/lib/api/routes.ts` (add routes)
- `src/lib/api/element-categories.ts` (new)
- `src/test/api/element-categories.test.ts` (new)

---

### Feature 2: Element Library CRUD

**Goal**: Master catalogue of construction elements with full CRUD, search, filter, and the two-panel split view.

**Database** — `scripts/migrate-elements.sql`:

```sql
CREATE TABLE element (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES element_category(id) ON DELETE SET NULL,
  unit VARCHAR(30) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  material_cost NUMERIC(12,2),
  labour_cost NUMERIC(12,2),
  overhead_pct NUMERIC(5,2) DEFAULT 0,
  margin_pct NUMERIC(5,2) DEFAULT 0,
  spec_reference VARCHAR(255),
  drawing_ref VARCHAR(255),
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE element_attribute (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id UUID NOT NULL REFERENCES element(id) ON DELETE CASCADE,
  attribute_key VARCHAR(100) NOT NULL,
  attribute_value TEXT NOT NULL,
  unit VARCHAR(30),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_element_code ON element(code);
CREATE INDEX idx_element_category ON element(category_id);
CREATE INDEX idx_element_active ON element(is_active);
CREATE INDEX idx_element_tags ON element USING GIN(tags);
CREATE INDEX idx_element_attribute_element ON element_attribute(element_id);
```

**Queries** — add to `queries.ts`:

- `getElements(filters)` — paginated, filterable by category, unit, tags, search text, is_active. Uses `ILIKE` for search on name+code+description
- `getElementById(id)` — includes attributes and category path
- `createElement(input)` — validate unique code, category exists
- `updateElement(id, input)` — validate unique code (exclude self)
- `deleteElement(id)` — soft delete (set is_active = false)
- `duplicateElement(id)` — copy with new code suffix
- `getElementAttributes(elementId)`
- `upsertElementAttributes(elementId, attributes[])` — delete+insert in transaction

**API Routes**:

- `GET /api/elements` — list with filters (query params: search, categoryId, unit, tags, isActive, page, limit)
- `POST /api/elements` — create element + attributes
- `GET /api/elements/[id]` — detail with attributes
- `PATCH /api/elements/[id]` — update
- `DELETE /api/elements/[id]` — soft delete
- `POST /api/elements/[id]/duplicate` — duplicate

**UI** — new page at `src/app/(dashboard)/elements/page.tsx`:

- Two-panel layout: CategoryTree (left 30%) | Element grid/table (right 70%)
- Top bar: search input, filter chips (unit, tags, active/inactive), Add Element button
- Table columns per PRD: Code, Name, Category (badge), Unit, Unit Cost, Margin % (color-coded), Tags, Status, Actions
- Click row → side drawer with full element detail + attributes
- Add/Edit element → Dialog form with all fields from PRD Table 15
- Margin color coding: green >15%, amber 8-15%, red <8%
- Status bar: total count, active count

**Sidebar**: Add "Elements" nav item for PM and Architect roles (gated on `features.elementLibrary`)

**Hook**: `useElements()` — SWR-based with filter state

**Zod Schemas**: Element create/update validation matching PRD Table 15 constraints

**Allowed units list**: Define `ALLOWED_UNITS` constant in `constants.ts`:

```ts
export const ALLOWED_UNITS = [
  "m2",
  "m3",
  "lm",
  "nr",
  "item",
  "kg",
  "tonne",
  "ls",
  "set",
  "pair",
  "roll",
  "sheet",
  "bag",
  "box",
  "pallet",
] as const;
```

Used in Zod schemas for validation and as dropdown options in UI.

**Edge case — archive with BOQ references**: When soft-deleting an element (`is_active = false`), check for referencing `boq_item` rows. If found, don't block the archive — but set a flag on those BOQ items indicating the source element is archived. Add `element_archived BOOLEAN DEFAULT false` to `boq_item` (in Feature 4 migration). The archive query updates both: `UPDATE element SET is_active = false` + `UPDATE boq_item SET element_archived = true WHERE element_id = $1`.

**Files to create/modify**:

- `scripts/migrate-elements.sql` (new)
- `src/lib/queries.ts` (add ~200 lines)
- `src/lib/constants.ts` (add ALLOWED_UNITS)
- `src/app/api/elements/route.ts` (new)
- `src/app/api/elements/[id]/route.ts` (new)
- `src/app/api/elements/[id]/duplicate/route.ts` (new)
- `src/app/(dashboard)/elements/page.tsx` (new)
- `src/app/(dashboard)/elements/_components/ElementTable.tsx` (new)
- `src/app/(dashboard)/elements/_components/ElementDrawer.tsx` (new)
- `src/app/(dashboard)/elements/_components/ElementForm.tsx` (new)
- `src/hooks/useElements.ts` (new)
- `src/lib/api/elements.ts` (new)
- `src/lib/api/routes.ts` (add routes)
- `src/lib/validations.ts` (add schemas)
- `src/types/index.ts` (add types)
- `src/components/layout/sidebar.tsx` (add nav item)
- `src/config/features.ts` (update flag)
- `src/test/api/elements.test.ts` (new)
- `src/test/unit/element-validations.test.ts` (new)

---

### Feature 3: Element Excel Import/Export

**Goal**: Bulk import elements from Excel, export current library to Excel.

**New dependency**: `xlsx` (SheetJS)

**Import flow** (matches PRD):

1. Upload .xlsx file
2. Parse and validate rows against PRD Table 16 rules
3. Show preview table with row-by-row validation status (valid/warning/error)
4. Handle duplicates: Skip / Overwrite / Create New Version (per PRD Table 17)
5. Architect confirms → bulk insert/update

**Export flow**:

- Download current filtered view as .xlsx
- Columns match import template

**API Routes**:

- `POST /api/elements/import` — accepts multipart form data, returns validation results
- `POST /api/elements/import/confirm` — executes the confirmed import
- `GET /api/elements/export` — returns .xlsx blob

**Queries**:

- `bulkUpsertElements(elements[], strategy)` — transactional bulk insert with duplicate handling
- `getElementsForExport(filters)` — all fields for export

**UI**:

- Import button in Element Library top bar → opens multi-step dialog:
  - Step 1: Upload file
  - Step 2: Column mapping preview (auto-mapped)
  - Step 3: Validation results table (errors in red, warnings in amber)
  - Step 4: Duplicate strategy selection
  - Step 5: Confirm import → progress bar → summary
- Export button → downloads filtered results

**Files to create/modify**:

- `package.json` (add `xlsx`)
- `src/app/api/elements/import/route.ts` (new)
- `src/app/api/elements/import/confirm/route.ts` (new)
- `src/app/api/elements/export/route.ts` (new)
- `src/app/(dashboard)/elements/_components/ImportDialog.tsx` (new)
- `src/lib/excel/elementParser.ts` (new — parse + validate Excel rows)
- `src/lib/queries.ts` (add bulk upsert)
- `src/test/api/elements-import.test.ts` (new)
- `src/test/unit/element-parser.test.ts` (new)

---

### Feature 4: BOQ Core (DB + API)

**Goal**: Database schema and API for BOQ management — the foundation for the BOQ UI.

**Database** — `scripts/migrate-boq.sql`:

```sql
CREATE TABLE boq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  version INTEGER DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted_to_client','client_approved','locked','superseded')),
  currency VARCHAR(3) DEFAULT 'USD',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  contingency_pct NUMERIC(5,2) DEFAULT 0,
  vat_pct NUMERIC(5,2) DEFAULT 0,
  minimum_margin_pct NUMERIC(5,2) DEFAULT 10,
  client_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  architect_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  issued_date DATE,
  approved_date DATE,
  notes TEXT,
  client_notes TEXT,
  snapshot JSONB,  -- populated when BOQ is locked (Feature 13) for version history
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE boq_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  budget_cap NUMERIC(12,2),
  is_visible_to_client BOOLEAN DEFAULT true
);

CREATE TABLE boq_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  section_id UUID REFERENCES boq_section(id) ON DELETE SET NULL,
  element_id UUID REFERENCES element(id) ON DELETE SET NULL,
  item_code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_cost NUMERIC(12,2),
  labour_cost NUMERIC(12,2),
  overhead_pct NUMERIC(5,2) DEFAULT 0,
  margin_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Two status tracks: lifecycle (internal flow) and client_approval (client-facing)
  lifecycle_status VARCHAR(30) DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','submitted','approved','rejected','queried','locked','change_order_pending','superseded')),
  client_approval_status VARCHAR(20) DEFAULT 'pending'
    CHECK (client_approval_status IN ('pending','approved','rejected','queried')),
  client_approved_at TIMESTAMPTZ,
  client_approved_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  requires_reapproval BOOLEAN DEFAULT false,
  element_archived BOOLEAN DEFAULT false,
  installed_qty NUMERIC(12,3) DEFAULT 0,
  has_snag BOOLEAN DEFAULT false,
  po_status VARCHAR(20) DEFAULT 'none'
    CHECK (po_status IN ('none','rfq_issued','quoted','po_raised','delivered')),
  notes TEXT,
  client_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_provisional BOOLEAN DEFAULT false,
  is_excluded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-numbering for RFQ, PO, CO, PROP sequences
CREATE TABLE sequence_counter (
  org_id UUID NOT NULL REFERENCES "organization"(id),
  prefix VARCHAR(20) NOT NULL,
  year INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, prefix, year)
);

CREATE INDEX idx_boq_project ON boq(project_id);
CREATE INDEX idx_boq_section_boq ON boq_section(boq_id);
CREATE INDEX idx_boq_item_boq ON boq_item(boq_id);
CREATE INDEX idx_boq_item_section ON boq_item(section_id);
CREATE INDEX idx_boq_item_element ON boq_item(element_id);
```

**Note on GENERATED columns**: The PRD specifies `total_cost`, `sell_price`, `progress_pct`, `margin_alert` as GENERATED ALWAYS AS columns. We'll compute these in SQL queries instead (using expressions in SELECT), because:

1. Our `pg` driver handles this cleanly
2. Computed columns can't reference other tables (margin threshold is per-BOQ)
3. More flexible for display logic

**Cost calculation expressions** (used in queries):

```sql
-- Per item:
quantity * unit_cost AS total_cost,
quantity * unit_cost * (1 + overhead_pct/100) AS subtotal,
quantity * unit_cost * (1 + overhead_pct/100) * (1 + margin_pct/100) AS sell_price,
CASE WHEN installed_qty > 0 THEN ROUND(installed_qty / NULLIF(quantity, 0) * 100, 1) ELSE 0 END AS progress_pct,
margin_pct < b.minimum_margin_pct AS margin_alert

-- Per BOQ:
SUM(sell_price) for non-excluded items AS boq_subtotal
boq_subtotal * (1 + contingency_pct/100) AS pre_vat_total
pre_vat_total * (1 + vat_pct/100) AS client_total
```

**Queries** — add to `queries.ts`:

- `createBoq(projectId, input)` — one BOQ per project (for now)
- `getBoq(boqId)` — full BOQ with sections, items (with computed columns), and summary totals
- `getBoqByProject(projectId)` — get project's active BOQ
- `updateBoq(boqId, input)` — update header fields
- `createBoqSection(boqId, input)`
- `updateBoqSection(sectionId, input)`
- `deleteBoqSection(sectionId)` — reassign items to null section
- `reorderBoqSections(boqId, orderedIds)`
- `createBoqItem(boqId, input)` — if element_id provided, copy defaults from element
- `updateBoqItem(itemId, input)` — validate status allows editing
- `deleteBoqItem(itemId)`
- `reorderBoqItems(sectionId, orderedIds)`
- `addElementToBoq(boqId, sectionId, elementId, quantity)` — shortcut to create item from element
- `getBoqSummary(boqId)` — totals, section breakdowns, margin bleed count

**API Routes**:

- `GET /api/projects/[id]/boq` — get project's BOQ (full data)
- `POST /api/projects/[id]/boq` — create BOQ for project
- `PATCH /api/projects/[id]/boq` — update BOQ header
- `POST /api/projects/[id]/boq/sections` — create section
- `PATCH /api/projects/[id]/boq/sections/[sectionId]` — update section
- `DELETE /api/projects/[id]/boq/sections/[sectionId]` — delete section
- `PATCH /api/projects/[id]/boq/sections/reorder` — reorder sections
- `POST /api/projects/[id]/boq/items` — create item
- `PATCH /api/projects/[id]/boq/items/[itemId]` — update item
- `DELETE /api/projects/[id]/boq/items/[itemId]` — delete item
- `PATCH /api/projects/[id]/boq/items/reorder` — reorder items
- `POST /api/projects/[id]/boq/items/from-element` — add element as BOQ item
- `GET /api/projects/[id]/boq/summary` — totals and stats

**Auth**: All BOQ routes require `projectAccess: true`. Write operations: `allowedRoles: ["pm", "architect"]`. Read: PM, Architect, Client (client sees filtered view — Feature 12).

**Optimistic locking**: All BOQ item update/delete mutations must include `updated_at` in the request body. The query uses `WHERE id = $1 AND updated_at = $2` — if 0 rows affected, another user edited the item. Return 409 Conflict with message "This item was updated by another user. Please refresh to see latest version." The client retries by re-fetching via SWR `mutate()`.

**Re-approval after edit** ⚠️ pending review (tab 6 Rule 3): If an architect edits a BOQ item that has `client_approval_status = 'approved'`, the current behaviour auto-flips `requires_reapproval = true` and `client_approval_status = 'pending'` — the client sees a "Modified after approval — re-approval required" badge. Tab 6 Rule 3 wants this replaced by a hard 409 response ("raise a change order"). Final call tracked under Revisions → Open decisions. Either way, `updateBoqItem` is where this is enforced.

**BOQ item lifecycle states** (two-track status):

- `lifecycle_status` tracks the internal workflow: draft → submitted → approved/rejected/queried → locked → change_order_pending → superseded
- `client_approval_status` tracks the client's decision per item: pending → approved/rejected/queried
- These are separate because lifecycle can be `locked` while client_approval is `approved`

**Auto-numbering**: The `sequence_counter` table (defined above in the migration SQL) generates sequential numbers.
Helper function `getNextSequenceNumber(orgId, prefix)` uses `UPDATE ... SET current_value = current_value + 1 RETURNING current_value` with `INSERT ON CONFLICT` for the first use in a year. Returns formatted string like `RFQ-2026-001`. Used by Features 4, 9, 11, 13, 14.

**BOQ versioning**: When a BOQ is locked (Feature 13), snapshot the current state to a `boq_snapshot` JSONB column on the `boq` table before incrementing `version`. This preserves the historical state. Add `snapshot JSONB` to the `boq` table. The snapshot contains all sections and items at the time of locking. Previous versions are queryable for audit/comparison but not editable.

**Zod Schemas**: BOQ, section, item create/update validation

**Files to create/modify**:

- `scripts/migrate-boq.sql` (new)
- `src/lib/queries.ts` (add ~400 lines)
- `src/app/api/projects/[id]/boq/route.ts` (new)
- `src/app/api/projects/[id]/boq/sections/route.ts` (new)
- `src/app/api/projects/[id]/boq/sections/[sectionId]/route.ts` (new)
- `src/app/api/projects/[id]/boq/sections/reorder/route.ts` (new)
- `src/app/api/projects/[id]/boq/items/route.ts` (new)
- `src/app/api/projects/[id]/boq/items/[itemId]/route.ts` (new)
- `src/app/api/projects/[id]/boq/items/reorder/route.ts` (new)
- `src/app/api/projects/[id]/boq/items/from-element/route.ts` (new)
- `src/app/api/projects/[id]/boq/summary/route.ts` (new)
- `src/lib/api/boq.ts` (new)
- `src/lib/api/routes.ts` (add routes)
- `src/lib/validations.ts` (add schemas)
- `src/types/index.ts` (add types)
- `src/test/api/boq.test.ts` (new)
- `src/test/api/boq-items.test.ts` (new)
- `src/test/api/boq-sections.test.ts` (new)

---

### Feature 5: BOQ UI

**Goal**: Full BOQ page with sectioned table, inline editing, cost calculations, margin alerts.

**New dependency**: ~~`@tanstack/react-table` (virtualised table for 1000+ rows)~~ — never wired up; the shipped `BoqTable` renders a plain grouped table. The dep was removed in perf Tier 4 (t4-01). Re-add it only as part of a dedicated virtualization effort if real BOQs exceed ~1000 line items.

**UI** — new page at `src/app/(dashboard)/projects/[id]/boq/page.tsx`:

**Layout** (per PRD Table 24):

- Top bar: Project name, BOQ title, version badge, status badge, last updated
- Action bar: Add Section, Add Item, Import Excel, Export PDF, Export Excel, Issue to Client, Lock BOQ
- Summary cards: Total Cost, Total Sell Price, Total Margin %, Pending Approvals, Margin Bleed Items
- Main table: Sectioned, collapsible (TanStack Table)
- Right sidebar: Item detail panel (opens on row click)
- Bottom bar: Grand totals, contingency, VAT, client total

**Table columns** (per PRD Table 25):

- Ref #, Description, Unit, Qty, Unit Cost, Total Cost (computed), Margin %, Sell Price (computed), Client Status, PO Status, Progress, Flags, Actions

**Inline editing**: Qty, Unit Cost, Margin %, Description, Unit are editable inline. Save on blur/Enter. Debounced API calls.

**Margin alerts**: Color-coded badges per PRD Table 18 (red <8%, amber 8-15%, green >15%). Items below project threshold get margin_alert flag.

**Section management**: Collapsible sections with section totals. Add/rename/delete/reorder sections.

**Element picker**: "Add from Library" button opens element search dialog → select → auto-fills item fields from element defaults.

**Hooks**:

- `useBoq(projectId)` — SWR-based, fetches full BOQ data
- `useBoqMutations(projectId)` — CRUD operations with SWR cache invalidation

**Sidebar**: Add "BOQ" tab to project detail page (alongside existing tabs)

**Files to create/modify**:

- ~~`package.json` (add `@tanstack/react-table`)~~ — removed in perf Tier 4 (t4-01); virtualization deferred
- `src/app/(dashboard)/projects/[id]/boq/page.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqTable.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqSummaryCards.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqItemDrawer.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqActionBar.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqBottomBar.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/ElementPicker.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/SectionHeader.tsx` (new)
- `src/hooks/useBoq.ts` (new)
- `src/app/(dashboard)/projects/[id]/_components/ProjectTabs.tsx` (modify — add BOQ tab)

---

### Feature 6: BOQ Excel Import/Export

**Goal**: Import BOQ items from Excel, export current BOQ to Excel/PDF.

**Import** (per PRD Table 29):

- Parse .xlsx with columns: Section, Item Code, Description, Unit, Quantity, Unit Cost, Margin %, Overhead %, Notes, Client Notes, Is Provisional
- Match item codes to Element Library elements (auto-link element_id)
- Validate against existing BOQ (duplicate codes, invalid units)
- Preview → confirm

**Export**:

- Excel: Full BOQ with all columns + section totals + grand total
- PDF: Client-facing view (no cost columns, only sell price) — basic PDF initially, enhanced in Feature 19

**API Routes**:

- `POST /api/projects/[id]/boq/import` — upload + validate
- `POST /api/projects/[id]/boq/import/confirm` — execute import
- `GET /api/projects/[id]/boq/export` — export as xlsx
- `GET /api/projects/[id]/boq/export/pdf` — export as PDF (basic)

**Files to create/modify**:

- `src/app/api/projects/[id]/boq/import/route.ts` (new)
- `src/app/api/projects/[id]/boq/import/confirm/route.ts` (new)
- `src/app/api/projects/[id]/boq/export/route.ts` (new)
- `src/lib/excel/boqParser.ts` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqImportDialog.tsx` (new)
- `src/test/api/boq-import.test.ts` (new)

---

### Feature 7: Vendor Management

**Goal**: Vendor profiles, contacts, and trade category mapping.

**Database** — `scripts/migrate-vendors.sql`:

```sql
CREATE TABLE vendor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  vendor_code VARCHAR(50) UNIQUE,
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','inactive','blacklisted','pending_approval')),
  rating NUMERIC(3,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  payment_terms VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'USD',
  vat_registered BOOLEAN DEFAULT false,
  vat_number VARCHAR(50),
  bank_details JSONB,
  address JSONB,
  notes TEXT,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendor_contact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  receives_rfq BOOLEAN DEFAULT true,
  user_id UUID REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE TABLE vendor_trade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES element_category(id) ON DELETE CASCADE,
  proficiency_level VARCHAR(20) DEFAULT 'standard'
    CHECK (proficiency_level IN ('standard','specialist','preferred')),
  notes TEXT
);

CREATE INDEX idx_vendor_org ON vendor(org_id);
CREATE INDEX idx_vendor_status ON vendor(status);
CREATE INDEX idx_vendor_contact_vendor ON vendor_contact(vendor_id);
CREATE INDEX idx_vendor_trade_vendor ON vendor_trade(vendor_id);
CREATE INDEX idx_vendor_trade_category ON vendor_trade(category_id);
```

**Queries**: Full CRUD for vendors, contacts, trades. `getVendorsByTrade(categoryId)` for RFQ vendor suggestion.

**API Routes**:

- `GET /api/vendors` — list with filters (search, status, trade)
- `POST /api/vendors` — create vendor + contacts + trades
- `GET /api/vendors/[id]` — detail with contacts and trades
- `PATCH /api/vendors/[id]` — update
- `DELETE /api/vendors/[id]` — soft delete (set inactive)
- `GET /api/vendors/by-trade/[categoryId]` — vendors matching a trade

**UI** — new page at `src/app/(dashboard)/vendors/page.tsx`:

- Vendor list with search, status filter, trade filter
- Vendor detail drawer/page with contacts tab, trades tab
- Add/edit vendor dialog

**Sidebar**: Add "Vendors" nav item for PM and Architect (gated on `features.vendorManagement`)

**Feature flag**: Add `vendorManagement: false` to `features.ts`

**Bank details encryption**: The `bank_details` JSONB field stores sensitive financial data (bank name, account number, IBAN, SWIFT). Encrypt at the application level before writing to DB:

- Use `crypto.createCipheriv('aes-256-gcm', key, iv)` with a `VENDOR_ENCRYPTION_KEY` env var
- Store as `{ encrypted: string, iv: string, tag: string }` in the JSONB column
- Decrypt on read in the query helper — never expose raw bank details in API responses unless explicitly requested
- Add `GET /api/vendors/[id]/bank-details` as a separate endpoint with stricter auth (PM only)

**Vendor ratings**: Ratings are manually assigned by the architect via a 5-star selector in the vendor detail view. Add `PATCH /api/vendors/[id]/rating` endpoint. Future enhancement: auto-calculate from delivery performance (on-time %, quality score from snags) — for now, manual is sufficient.

**Files to create/modify**:

- `scripts/migrate-vendors.sql` (new)
- `src/lib/queries.ts` (add ~200 lines)
- `src/lib/vendorEncryption.ts` (new — encrypt/decrypt helpers)
- `src/app/api/vendors/route.ts` (new)
- `src/app/api/vendors/[id]/route.ts` (new)
- `src/app/api/vendors/[id]/bank-details/route.ts` (new)
- `src/app/api/vendors/[id]/rating/route.ts` (new)
- `src/app/api/vendors/by-trade/[categoryId]/route.ts` (new)
- `src/app/(dashboard)/vendors/page.tsx` (new)
- `src/app/(dashboard)/vendors/_components/*.tsx` (new)
- `src/hooks/useVendors.ts` (new)
- `src/lib/api/vendors.ts` (new)
- `src/lib/api/routes.ts` (add routes)
- `src/types/index.ts` (add types)
- `src/components/layout/sidebar.tsx` (add nav item)
- `src/config/features.ts` (add flag)
- `src/test/api/vendors.test.ts` (new)

---

### Feature 7.1: Vendor Tax ID + KYC Documents

**Goal**: Capture vendor compliance information (tax ID, trade licence, certifications) on the vendor record so PMs can verify a vendor before transacting. F7 only stores `vat_number` + `vat_registered`, which doesn't cover non-EU jurisdictions or supporting documents.

**Why slotted here**: Trivial extension to F7 — additive columns + one new table. Should ship before F8 (Vendor Portal) so vendor users can see their own KYC status in the portal.

**Database** — `scripts/migrate-vendor-kyc.sql`:

```sql
BEGIN;

ALTER TABLE vendor
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_verified_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kyc_notes TEXT;

CREATE TABLE vendor_kyc_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) NOT NULL
    CHECK (doc_type IN ('tax_certificate','trade_licence','iso_certification','insurance','other')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  expires_at DATE,
  uploaded_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX idx_vendor_kyc_doc_vendor ON vendor_kyc_document(vendor_id);
CREATE INDEX idx_vendor_kyc_doc_expiring
  ON vendor_kyc_document(expires_at)
  WHERE expires_at IS NOT NULL;

COMMIT;
```

**Queries** — extend `src/lib/queries/vendors.ts`:

- `addKycDocument(vendorId, input)` — upload + insert
- `listKycDocuments(vendorId)` — for the vendor drawer KYC tab
- `removeKycDocument(docId, vendorId)` — soft path: keep file in storage, just delete row
- `setKycStatus(vendorId, status, notes, verifiedBy)` — PM-only status flip
- Extend `getVendor(id)` to include `tax_id`, `kyc_status`, and a count of expiring-within-30-days docs

**API Routes**:

- `GET /api/vendors/[id]/kyc-documents` — list
- `POST /api/vendors/[id]/kyc-documents` — add (multipart / signed-URL flow, same pattern as element media)
- `DELETE /api/vendors/[id]/kyc-documents/[docId]` — remove
- `PATCH /api/vendors/[id]/kyc-status` — PM-only status update

**Auth**:

- Read: PM + Architect.
- Write KYC docs: PM + Architect.
- Set kyc_status: **PM only** — verification is a financial-control decision, not an operational one.

**UI** — extend the existing `VendorDrawer`:

- New **KYC** tab alongside Overview / Contacts / Trades / Bank.
- Top: `tax_id` input, `kyc_status` badge with PM-only "Mark verified / pending / rejected" actions.
- Document list with type, file name, expiry date, "expiring soon" amber badge if within 30 days.
- "Add document" button reusing `FileUploadSlot` (the component shipped in PR #80).
- Vendor list page: optional `KYC` filter chip (verified / pending / unverified / rejected) + a small status dot in the table row so PMs can spot unverified vendors at a glance.

**Files to create/modify**:

- `scripts/migrate-vendor-kyc.sql` (new)
- `src/lib/queries/vendors.ts` (add ~120 lines)
- `src/app/api/vendors/[id]/kyc-documents/route.ts` (new)
- `src/app/api/vendors/[id]/kyc-documents/[docId]/route.ts` (new)
- `src/app/api/vendors/[id]/kyc-status/route.ts` (new)
- `src/app/(dashboard)/vendors/_components/VendorKycTab.tsx` (new)
- `src/app/(dashboard)/vendors/_components/VendorDrawer.tsx` (modify — add KYC tab)
- `src/app/(dashboard)/vendors/_components/VendorList.tsx` (modify — KYC filter + dot)
- `src/lib/api/vendors.ts` (add KYC methods)
- `src/lib/api/routes.ts` (add routes)
- `src/lib/validations.ts` (`vendorKycDocumentSchema`, `vendorKycStatusSchema`)
- `src/types/index.ts` (add `VendorKycDocument`, `VendorKycStatus`)
- `messages/en.json`, `messages/tr.json` (add KYC namespace)
- `src/test/api/vendor-kyc.test.ts` (new)

**Open decisions**:

1. **Auto-flip to `pending` on document upload?** When the first KYC doc is uploaded, should the status auto-move from `unverified` → `pending` (queues it for PM review)? Default: yes — saves a click and signals there's something to review.
2. **Block POs for unverified vendors?** Tab 6 Rule 1 already blocks POs for unapproved BOQ items. Should we also block them for `kyc_status != 'verified'` vendors? Default: warn, don't block, since some orgs may want to use a vendor before formal verification. Make it an org setting.
3. **Expiry reminders.** When `expires_at` is within N days, send a notification to the PM. Defer to F18 dashboard widgets.

---

### Feature 7.5: Rate Contracts

**Goal**: Vendor-scoped, time-bound element pricing. Lets architects pre-negotiate rates with vendors and import those rates straight into a BOQ without going through the RFQ → quote loop.

**Why slotted here**: Depends on F7 (vendors) and F2 (elements) — both shipped. Independent of F8 (vendor role), F9 (RFQ), F10 (quotes). Gives BOQ a fast pricing path; RFQ remains the way to source new rates.

**Database** — `scripts/migrate-rate-contracts.sql`:

```sql
CREATE TABLE rate_contract (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','expired','cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  agreement_signed_date DATE,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms VARCHAR(100),
  agreement_url TEXT,
  terms_and_conditions TEXT,
  notes TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_rate_contract_dates CHECK (end_date >= start_date)
);

CREATE TABLE rate_contract_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_contract_id UUID NOT NULL REFERENCES rate_contract(id) ON DELETE CASCADE,
  element_id UUID NOT NULL REFERENCES element(id) ON DELETE CASCADE,
  unit VARCHAR(30) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  notes TEXT,
  UNIQUE (rate_contract_id, element_id)
);

CREATE INDEX idx_rate_contract_org ON rate_contract(org_id);
CREATE INDEX idx_rate_contract_vendor ON rate_contract(vendor_id);
CREATE INDEX idx_rate_contract_active ON rate_contract(org_id, status)
  WHERE status = 'active';
CREATE INDEX idx_rate_contract_item_contract ON rate_contract_item(rate_contract_id);
CREATE INDEX idx_rate_contract_item_element ON rate_contract_item(element_id);
```

**Auto-numbering**: Use the existing `sequence_counter` infra (F4) with prefix `RC` → `RC-2026-001`.

**Auto-expiry**: `getRateContracts()` flips `status = 'active' → 'expired'` on read when `end_date < CURRENT_DATE`. Same check-on-read pattern as quote/proposal expiry.

**Queries** — new file `src/lib/queries/rateContracts.ts`:

- `createRateContract(orgId, input)` — header only; items are added separately
- `getRateContractById(id, orgId)` — full record with items + vendor + element refs
- `listRateContracts(orgId, filters)` — list with vendor/status/date filters
- `updateRateContract(id, orgId, fields)` — header allow-list (cannot mutate after `active` except status)
- `deleteRateContract(id, orgId)` — soft-delete via `status = 'cancelled'`
- `addRateContractItems(id, orgId, items)` — bulk insert; ON CONFLICT (contract, element) DO UPDATE rate
- `removeRateContractItem(itemId, orgId)`
- `activateRateContract(id, orgId)` — flips `draft → active`; rejects if items list is empty
- `getActiveRateForElement(orgId, elementId, vendorId?)` — returns the lowest active rate for that element across contracts (or scoped to a vendor); used by the BOQ "Import from Rate Contract" picker

**API Routes**:

- `GET /api/rate-contracts` — list with filters
- `POST /api/rate-contracts` — create header
- `GET /api/rate-contracts/[id]` — detail
- `PATCH /api/rate-contracts/[id]` — update
- `DELETE /api/rate-contracts/[id]` — cancel
- `POST /api/rate-contracts/[id]/items` — bulk add items
- `DELETE /api/rate-contracts/[id]/items/[itemId]` — remove item
- `POST /api/rate-contracts/[id]/activate` — activate
- `GET /api/rate-contracts/by-element/[elementId]` — active rates available for an element (for BOQ picker)

**Auth**: `allowedRoles: ["pm", "architect"]` for write; `pm | architect` for read. Vendors do not see rate contracts in their portal — these are internal pricing.

**UI** — extend Element Library with a sibling tab:

- `src/app/(dashboard)/elements/page.tsx` — add a tab/route switcher between `Element Library` and `Rate Contracts`. Cleaner option: lift to a parent layout and split into `/elements/library` and `/elements/rate-contracts`.
- `src/app/(dashboard)/elements/rate-contracts/page.tsx` — list page with vendor + status filters, "Add Rate Contract" CTA.
- `src/app/(dashboard)/elements/rate-contracts/[id]/page.tsx` — detail/edit page with header form, vendor link, item table, agreement upload, terms editor, activate/cancel actions.
- `src/app/(dashboard)/elements/rate-contracts/_components/RateContractItemPicker.tsx` — element-library picker that returns elements + lets the user enter rates inline (mirrors RDash's "Add Elements" flow).

**BOQ integration** — extend the shipped `BoqElementPickerDialog`:

- Add a third tab: `From Rate Contract`. Lists elements available across active rate contracts, with vendor + rate displayed. Selecting a row creates a `boq_item` with `source = 'rate_contract'` (F6.1, shipped PR #81) and `unit_cost = rate`.
- Backend: extend `addElementToBoq` to accept an optional `rate_contract_item_id` and copy the rate when present. Persist the link by adding `rate_contract_item_id UUID REFERENCES rate_contract_item(id) ON DELETE SET NULL` to `boq_item` in this feature's migration.

**Zod Schemas**: rate-contract create/update + item-bulk-add schemas in `src/lib/validations.ts`.

**Files to create/modify**:

- `scripts/migrate-rate-contracts.sql` (new)
- `src/lib/queries/rateContracts.ts` (new ~250 lines)
- `src/lib/queries/boq.ts` (extend `addElementToBoq` to accept `rate_contract_item_id`)
- `src/app/api/rate-contracts/route.ts` (new)
- `src/app/api/rate-contracts/[id]/route.ts` (new)
- `src/app/api/rate-contracts/[id]/items/route.ts` (new)
- `src/app/api/rate-contracts/[id]/items/[itemId]/route.ts` (new)
- `src/app/api/rate-contracts/[id]/activate/route.ts` (new)
- `src/app/api/rate-contracts/by-element/[elementId]/route.ts` (new)
- `src/app/(dashboard)/elements/rate-contracts/page.tsx` (new)
- `src/app/(dashboard)/elements/rate-contracts/[id]/page.tsx` (new)
- `src/app/(dashboard)/elements/rate-contracts/_components/*.tsx` (new — list, form, item table, picker)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqElementPickerDialog.tsx` (modify — add rate-contract tab)
- `src/lib/api/rateContracts.ts` (new)
- `src/lib/api/routes.ts` (add routes)
- `src/lib/validations.ts` (add schemas)
- `src/types/index.ts` (add types)
- `src/config/features.ts` (`rateContracts: false` flag)
- `messages/en.json`, `messages/tr.json` (add namespace)
- `src/test/api/rate-contracts.test.ts` (new)

**Open decisions**:

1. **Multi-currency**: rate contracts inherit `org` currency. If a vendor's rate is in a different currency, do we store it in the contract currency and convert at BOQ-import time? Defer until F4.5 / F-int-1 — for now, force same currency.
2. **Rate priority when multiple active contracts cover the same element**: lowest rate wins by default. PM can override by picking a specific contract from the BOQ picker.
3. **Element archive interaction**: if an element is archived (F2 soft-delete), existing rate-contract items keep working but the picker hides them (existing F2 archive pattern).

---

### Feature 8: Vendor Role + Portal

**Goal**: Add vendor as a new auth role with its own portal view.

**Auth changes**:

- Add `"vendor"` to `UserRole` type
- Add `vendor` role to better-auth org plugin in `permissions.ts`
- Update `withAuth.ts` role derivation to handle vendor
- Vendor is invited to org with `vendor` role → linked to vendor record via `vendor_contact.user_id`

**Sidebar**: New `vendorNav` array in `sidebar.tsx`:

- Dashboard (vendor-specific)
- RFQs (assigned to them)
- Purchase Orders (issued to them)
- Settings

**UI**:

- `src/app/(dashboard)/(vendor)/` — vendor-facing pages
- Vendor dashboard: open RFQs, active POs, quote status

**Files to create/modify**:

- `src/types/index.ts` (update UserRole)
- `src/lib/permissions.ts` (add vendor role)
- `src/lib/withAuth.ts` (update role derivation)
- `src/components/layout/sidebar.tsx` (add vendorNav)
- `src/app/(dashboard)/(vendor)/page.tsx` (new — placeholder for now)
- `src/lib/auth.ts` (update databaseHooks for vendor role detection)

---

### Feature 8.5: Vendor Self-Service Profile

**Goal**: Let logged-in vendors update their own vendor record from the portal — bank details, KYC docs, and additional contact users — without requiring PM involvement. Mirrors RDash's "Other Details" tab on the vendor side.

**Why slotted here**: Depends on F8 (vendor role + portal exists). Reuses the F7 / F7.1 data layer entirely — no new tables, no new schemas. Removes a manual touchpoint where PMs would otherwise re-enter every bank-detail change a vendor mails them.

**Scope resolution**: a vendor's `vendor_id` is resolved server-side via `SELECT vendor_id FROM vendor_contact WHERE user_id = $current_user LIMIT 1`. Cached on the auth context to avoid the lookup on every request. If a single user is linked to multiple vendor records (rare — multi-company contacts), pick the most recently linked.

**Authz**: every vendor-portal API route uses `withAuth({ allowedRoles: ["vendor"] })` and forces `vendor_id = ctx.vendorId` server-side. Vendors cannot pass a `vendor_id` in the body or query — it's always derived from session. Prevents IDOR even if the client is tampered with.

**API Routes** — under `src/app/api/vendor-portal/`:

- `GET /api/vendor-portal/me` — full vendor record (own vendor only)
- `PATCH /api/vendor-portal/me` — update top-level fields (company name read-only; vendor cannot rename themselves — needs PM approval)
- `PATCH /api/vendor-portal/me/bank-details` — encrypted bank details (reuses F7's encrypt/decrypt helpers)
- `POST /api/vendor-portal/me/kyc-documents` — upload KYC doc (reuses F7.1 upload logic)
- `DELETE /api/vendor-portal/me/kyc-documents/:id` — remove a doc (only their own)
- `POST /api/vendor-portal/me/contacts` — add an additional contact user (vendor-internal team)
- `PATCH /api/vendor-portal/me/contacts/:id` — edit contact (own vendor's contacts only)
- `DELETE /api/vendor-portal/me/contacts/:id` — remove

**KYC verification status**: vendors can upload / replace KYC docs but **cannot** mark them verified — `kyc_status` stays read-only on this side. PM verifies in F7.1's KYC tab. After a vendor re-uploads, status flips to `pending` automatically (re-verification needed).

**UI** — `src/app/(dashboard)/(vendor)/profile/`:

- Reuse `VendorBankDetailsForm`, `VendorKycTab`, and a contact-management subset of `VendorContactsEditor` (already built for F7 / F7.1) — pre-loaded with the vendor's own record. Same look as PM-side vendor edit, just no vendor selector.
- Read-only fields: company name, vendor code, status (set by PM), KYC verification status (set by PM).
- Editable: trading name, address, primary contact details, bank details, KYC docs, additional contact users.

**Sidebar**: add a "Profile" entry to `vendorNav` (between Invoices and Settings).

**Files to create/modify**:

- `src/lib/queries/vendors.ts` (extend with `getVendorByUserId`, `updateVendorByUserId`, scoped contact CRUD)
- `src/lib/withAuth.ts` (resolve `ctx.vendorId` when role is `"vendor"`)
- `src/app/api/vendor-portal/me/route.ts` (GET, PATCH)
- `src/app/api/vendor-portal/me/bank-details/route.ts`
- `src/app/api/vendor-portal/me/kyc-documents/route.ts` (POST + per-doc DELETE)
- `src/app/api/vendor-portal/me/contacts/route.ts` (POST + per-contact PATCH/DELETE)
- `src/app/(dashboard)/(vendor)/profile/page.tsx` (new)
- `src/components/layout/sidebar.tsx` (add Profile nav entry)
- `src/lib/api/vendor-portal.ts` (typed wrappers — new domain module)
- `src/lib/api/routes.ts` (add `/vendor-portal/*` routes)
- `messages/{en,tr}.json` (`vendorPortal.profile.*` namespace)
- `src/test/api/vendor-portal-me.test.ts` (verifies authz scoping — vendors can only see/modify their own vendor)

**Open decisions**:

1. **Should vendors edit `payment_terms` or `currency`?** PM-set commercial terms — probably read-only on vendor side. Recommend yes-readonly (they can see what was agreed, can't change unilaterally).
2. **Audit logging**: every vendor self-edit writes to `audit_log` (when F21 ships). Skip for now; reuse F21 infra later.

---

### Feature 9: RFQ Workflow

**Goal**: Create RFQ packages from BOQ items, issue to vendors.

**Database** — `scripts/migrate-rfq.sql`:

```sql
CREATE TABLE rfq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  rfq_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','quotes_received','under_review','awarded','cancelled')),
  issued_date DATE,
  response_deadline DATE,
  award_date DATE,
  awarded_vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  scope_of_work TEXT,
  terms_conditions TEXT,
  attachments JSONB,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rfq_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  boq_item_id UUID NOT NULL REFERENCES boq_item(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  spec_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Split award columns (populated when items are awarded to different vendors)
  awarded_vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  awarded_quote_item_id UUID REFERENCES vendor_quote_item(id) ON DELETE SET NULL
);

CREATE INDEX idx_rfq_project ON rfq(project_id);
CREATE INDEX idx_rfq_status ON rfq(status);
CREATE INDEX idx_rfq_item_rfq ON rfq_item(rfq_id);
CREATE INDEX idx_rfq_item_boq ON rfq_item(boq_item_id);
```

**Auto-numbering**: RFQ number format `RFQ-{YEAR}-{SEQ}` generated in query.

**Vendor suggestion**: When creating RFQ, system suggests vendors whose `vendor_trade.category_id` matches the BOQ items' element categories.

**Email notification**: When RFQ is issued, send email to selected vendor contacts (where `receives_rfq = true`) with portal deep link.

**API Routes**:

- `GET /api/projects/[id]/rfqs` — list RFQs
- `POST /api/projects/[id]/rfqs` — create RFQ + items
- `GET /api/projects/[id]/rfqs/[rfqId]` — detail
- `PATCH /api/projects/[id]/rfqs/[rfqId]` — update
- `POST /api/projects/[id]/rfqs/[rfqId]/issue` — issue to vendors (sends emails, updates status)
- `POST /api/projects/[id]/rfqs/[rfqId]/cancel` — cancel RFQ
- `GET /api/projects/[id]/rfqs/[rfqId]/suggested-vendors` — auto-suggest by trade

**UI**:

- RFQ list within project (tab alongside BOQ)
- Create RFQ: select BOQ items → auto-populate RFQ items → select vendors → set deadline → issue
- RFQ detail view with status timeline

**Files to create/modify**:

- `scripts/migrate-rfq.sql` (new)
- `src/lib/queries.ts` (add ~200 lines)
- `src/lib/email.ts` (add RFQ notification email)
- `src/app/api/projects/[id]/rfqs/` (new — multiple route files)
- `src/app/(dashboard)/projects/[id]/rfqs/` (new — page + components)
- `src/hooks/useRfqs.ts` (new)
- `src/lib/api/rfqs.ts` (new)
- `src/types/index.ts` (add types)
- `src/test/api/rfqs.test.ts` (new)

---

### Feature 10: Vendor Quotes

**Goal**: Vendors submit itemised quotes against RFQs. Architects compare quotes side-by-side.

**Database** — `scripts/migrate-quotes.sql`:

```sql
CREATE TABLE vendor_quote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','awarded','rejected','expired')),
  submitted_at TIMESTAMPTZ,
  valid_until DATE,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  delivery_period VARCHAR(100),
  payment_terms VARCHAR(100),
  inclusions TEXT,
  exclusions TEXT,
  notes TEXT,
  attachments JSONB,
  is_late BOOLEAN DEFAULT false,  -- true if submitted after rfq.response_deadline
  awarded_at TIMESTAMPTZ,
  awarded_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vendor_quote_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES vendor_quote(id) ON DELETE CASCADE,
  rfq_item_id UUID NOT NULL REFERENCES rfq_item(id) ON DELETE CASCADE,
  unit_price NUMERIC(12,2) NOT NULL,
  notes TEXT,
  alternative_spec TEXT
);

CREATE INDEX idx_quote_rfq ON vendor_quote(rfq_id);
CREATE INDEX idx_quote_vendor ON vendor_quote(vendor_id);
CREATE INDEX idx_quote_item_quote ON vendor_quote_item(quote_id);
```

**Quote comparison table**: Side-by-side view of all vendor quotes for an RFQ — rows are RFQ items, columns are vendors. Highlights lowest price per item. Shows delivery period, payment terms, inclusions/exclusions per vendor.

**Quote expiry**: Quotes have `valid_until` dates. The `getQuotesByRfq()` query checks `valid_until < NOW()` and auto-sets `status = 'expired'` on read (check-on-read pattern). Expired quotes are visually dimmed in the comparison table and cannot be awarded. No cron job needed.

**Late quote handling**: If a vendor submits after `rfq.response_deadline`, accept the quote but add `is_late BOOLEAN DEFAULT false` flag (add to `vendor_quote` schema). Show "Late submission" badge in comparison table. Late quotes can still be considered.

**Award flow — single or split**:

- **Single award** (default): Architect selects one winning vendor for the entire RFQ → RFQ status → awarded, winning quote → awarded, other quotes → rejected. BOQ items' `po_status` → `quoted`.
- **Split award**: Architect awards at the `rfq_item` level — different vendors can win different items. Add `awarded_vendor_id UUID` and `awarded_quote_item_id UUID` columns to `rfq_item`. RFQ status → `awarded` when all items are awarded. Multiple POs are created (one per vendor).

**API Routes**:

- `POST /api/rfqs/[rfqId]/quotes` — vendor submits quote (vendor auth)
- `GET /api/rfqs/[rfqId]/quotes` — all quotes for an RFQ (architect)
- `GET /api/rfqs/[rfqId]/quotes/[quoteId]` — quote detail
- `GET /api/rfqs/[rfqId]/comparison` — comparison table data
- `POST /api/rfqs/[rfqId]/award` — award entire RFQ to one vendor
- `POST /api/rfqs/[rfqId]/award-split` — award individual items to different vendors

**Vendor portal**: Quote submission form linked from RFQ email deep link.

**Files to create/modify**:

- `scripts/migrate-quotes.sql` (new)
- `src/lib/queries.ts` (add ~200 lines)
- `src/app/api/rfqs/[rfqId]/quotes/` (new)
- `src/app/api/rfqs/[rfqId]/comparison/route.ts` (new)
- `src/app/api/rfqs/[rfqId]/award/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/rfqs/[rfqId]/` (expand with comparison view)
- `src/app/(dashboard)/(vendor)/rfqs/[rfqId]/` (new — vendor quote submission)
- `src/types/index.ts` (add types)
- `src/test/api/quotes.test.ts` (new)

---

### Feature 11: Client Proposals

**Goal**: Generate client proposals from awarded quotes with markup, send to client for approval.

**Database** — `scripts/migrate-proposals.sql`:

```sql
CREATE TABLE client_proposal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  proposal_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','approved','rejected','expired')),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  validity_days INTEGER DEFAULT 30,
  cover_letter TEXT,
  pdf_url TEXT,
  digital_signature JSONB,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proposal_project ON client_proposal(project_id);
CREATE INDEX idx_proposal_boq ON client_proposal(boq_id);
```

**Flow**: Create proposal from BOQ → select template (or default) → add cover letter → generate PDF → send to client via email → client views/approves/rejects in portal.

**Proposal templates**: Add a `proposal_template` table for reusable proposal formats:

```sql
CREATE TABLE proposal_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  header_html TEXT,          -- rendered above BOQ items
  footer_html TEXT,          -- rendered below (terms, conditions)
  show_sections BOOLEAN DEFAULT true,
  show_unit_prices BOOLEAN DEFAULT true,
  show_quantities BOOLEAN DEFAULT true,
  logo_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Add `template_id UUID REFERENCES proposal_template(id)` to the `client_proposal` table. Templates control which columns appear in the client-facing PDF and what header/footer text wraps the BOQ data.

**Proposal expiry**: Proposals have `validity_days` (default 30). The `getProposals()` query checks `sent_at + validity_days < NOW()` and auto-sets `status = 'expired'` on read (same check-on-read pattern as quote expiry).

**API Routes**:

- `GET /api/projects/[id]/proposals` — list proposals
- `POST /api/projects/[id]/proposals` — create proposal
- `GET /api/projects/[id]/proposals/[proposalId]` — detail
- `PATCH /api/projects/[id]/proposals/[proposalId]` — update
- `POST /api/projects/[id]/proposals/[proposalId]/send` — send to client
- `POST /api/projects/[id]/proposals/[proposalId]/approve` — client approves (client auth)
- `POST /api/projects/[id]/proposals/[proposalId]/reject` — client rejects
- `GET /api/proposal-templates` — list org templates
- `POST /api/proposal-templates` — create template
- `PATCH /api/proposal-templates/[id]` — update template
- `DELETE /api/proposal-templates/[id]` — delete template

**Files to create/modify**:

- `scripts/migrate-proposals.sql` (new — includes proposal_template table)
- `src/lib/queries.ts` (add ~200 lines)
- `src/lib/email.ts` (add proposal email)
- `src/app/api/projects/[id]/proposals/` (new)
- `src/app/api/proposal-templates/` (new)
- `src/app/(dashboard)/projects/[id]/proposals/` (new — page + components)
- `src/types/index.ts` (add types)
- `src/test/api/proposals.test.ts` (new)

---

### Feature 12: Client BOQ Portal

**Goal**: Extend existing client portal with BOQ view and item-level approval.

**What exists**: Client portal already has project list, task review, comments. We extend it.

**Client BOQ sub-nav** (per PRD tab 5 + Table 43):

- **Scope**: Filtered BOQ view — item descriptions, quantities, units, proposed prices only (NO costs, margins, overheads). Client can Approve/Reject/Query per item.
- **Proposals**: List of proposals with status badges. View PDF, approve, reject.
- **Orders**: Read-only log of approved BOQ items — see F24.
- **Client Invoices**: Bills the org has issued to the client — see F22.
- **Payments**: Payments the client has made against those invoices — see F23.

Change Orders and Progress are surfaced via notifications + inline badges on BOQ items, not as dedicated client tabs. The client can drill into a specific item to see its CO history or progress bar.

**Client BOQ approval workflow** (per PRD Table 28):

- Items start as `pending`
- Client can approve → status = `approved`
- Client can reject → status = `rejected` → goes back to architect as draft
- Client can query → status = `queried` → threaded discussion

**API Routes**:

- `GET /api/client/projects/[id]/boq` — client-filtered BOQ (no cost columns)
- `POST /api/client/projects/[id]/boq/items/[itemId]/approve` — approve item
- `POST /api/client/projects/[id]/boq/items/[itemId]/reject` — reject item
- `POST /api/client/projects/[id]/boq/items/[itemId]/query` — add query

**Auth**: `allowedRoles: ["client"]`, `projectAccess: true` (via client_email match)

**Files to create/modify**:

- `src/app/api/client/projects/[id]/boq/` (new)
- `src/app/(dashboard)/projects/[id]/_components/` (extend client view)
- `src/lib/queries.ts` (add client-filtered BOQ queries)
- `src/test/api/client-boq.test.ts` (new)

---

### Feature 13: BOQ Locking + Change Orders

**Goal**: Lock approved BOQs, manage scope changes through formal change orders.

**BOQ locking**:

- When all items are approved → architect can lock BOQ → status = `locked`
- Locked BOQ items cannot be edited — any change requires a Change Order
- UI shows lock icon, disables inline editing, shows "Raise Change Order" button

**Database** — `scripts/migrate-change-orders.sql`:

```sql
CREATE TABLE change_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  co_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted_to_client','client_approved','client_rejected','implemented','cancelled')),
  programme_impact_days INTEGER,
  submitted_at TIMESTAMPTZ,
  client_decision_at TIMESTAMPTZ,
  client_decision_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  client_rejection_reason TEXT,
  implemented_at TIMESTAMPTZ,
  pdf_url TEXT,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE change_order_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES change_order(id) ON DELETE CASCADE,
  change_type VARCHAR(20) NOT NULL
    CHECK (change_type IN ('addition','omission','substitution','quantity_change')),
  boq_item_id UUID REFERENCES boq_item(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit VARCHAR(30),
  original_quantity NUMERIC(12,3),
  new_quantity NUMERIC(12,3),
  unit_cost NUMERIC(12,2),
  justification TEXT
);

CREATE INDEX idx_co_project ON change_order(project_id);
CREATE INDEX idx_co_boq ON change_order(boq_id);
CREATE INDEX idx_co_item_co ON change_order_item(change_order_id);
```

**Change order workflow** (per PRD Table 51):

- `draft` → architect edits items, adds justification
- `submitted_to_client` → client reviews
- `client_approved` → architect implements (atomic BOQ update)
- `client_rejected` → architect revises or cancels
- `implemented` → changes applied to BOQ (old items → superseded, new items created)
- `cancelled` → read-only record

**Implement CO** (critical — per PRD Table 56 row 6 + tab 6 Rule 4):

- Atomic transaction: for each CO item, apply changes to BOQ
- **Before applying**: snapshot the current BOQ state to `boq.snapshot` and bump `boq.version` (tab 6 Rule 4 — never overwrite, always version)
- Addition → create new boq_item
- Omission → mark existing item as excluded
- Substitution → supersede old item, create new item
- Quantity change → update quantity on existing item
- If transaction fails → rollback (including the version bump), keep CO in `client_approved` state

**API Routes**:

- `GET /api/projects/[id]/change-orders` — list
- `POST /api/projects/[id]/change-orders` — create
- `GET /api/projects/[id]/change-orders/[coId]` — detail
- `PATCH /api/projects/[id]/change-orders/[coId]` — update
- `POST /api/projects/[id]/change-orders/[coId]/submit` — submit to client
- `POST /api/projects/[id]/change-orders/[coId]/approve` — client approves
- `POST /api/projects/[id]/change-orders/[coId]/reject` — client rejects
- `POST /api/projects/[id]/change-orders/[coId]/implement` — apply to BOQ
- `POST /api/projects/[id]/change-orders/[coId]/cancel` — cancel
- `POST /api/projects/[id]/boq/lock` — lock the BOQ

**Files to create/modify**:

- `scripts/migrate-change-orders.sql` (new)
- `src/lib/queries.ts` (add ~300 lines)
- `src/app/api/projects/[id]/change-orders/` (new — multiple route files)
- `src/app/api/projects/[id]/boq/lock/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/change-orders/` (new — page + components)
- `src/types/index.ts` (add types)
- `src/test/api/change-orders.test.ts` (new)

---

### Feature 14: Purchase Orders

**Goal**: Create POs from awarded quotes, track delivery.

**Database** — `scripts/migrate-purchase-orders.sql`:

```sql
CREATE TABLE purchase_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
  rfq_id UUID REFERENCES rfq(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES vendor_quote(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','acknowledged','partially_delivered','delivered','invoiced','paid','cancelled')),
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date_expected DATE,
  delivery_date_actual DATE,
  delivery_address JSONB,
  payment_terms VARCHAR(100),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes_to_vendor TEXT,
  internal_notes TEXT,
  pdf_url TEXT,
  acknowledgement_at TIMESTAMPTZ,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE po_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES boq_item(id) ON DELETE SET NULL,
  quote_item_id UUID REFERENCES vendor_quote_item(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  delivered_qty NUMERIC(12,3) DEFAULT 0,
  delivery_status VARCHAR(20) DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','partial','complete'))
);

CREATE INDEX idx_po_project ON purchase_order(project_id);
CREATE INDEX idx_po_vendor ON purchase_order(vendor_id);
CREATE INDEX idx_po_item_po ON po_item(po_id);
```

**Auto-create from award**: When a quote is awarded (Feature 10), optionally auto-create a PO draft with items pre-populated from the quote.

**Approval gate** (per PRD tab 6 Rule 1): `POST /purchase-orders` must reject if any referenced `boq_item.client_approval_status ≠ 'approved'`. Return 422 with `{ error, code: "UNAPPROVED_BOQ_ITEMS", itemCodes: [...] }` listing the offending item codes so the UI can highlight them. Same check on PATCH when line items are added or swapped after create.

**API Routes**:

- `GET /api/projects/[id]/purchase-orders` — list POs
- `POST /api/projects/[id]/purchase-orders` — create PO
- `GET /api/projects/[id]/purchase-orders/[poId]` — detail
- `PATCH /api/projects/[id]/purchase-orders/[poId]` — update
- `POST /api/projects/[id]/purchase-orders/[poId]/issue` — issue to vendor
- `PATCH /api/projects/[id]/purchase-orders/[poId]/items/[itemId]/delivery` — update delivery
- `POST /api/projects/[id]/purchase-orders/[poId]/acknowledge` — vendor acknowledges

**Vendor portal**: PO list + detail view for vendors. Acknowledge receipt button.

**Files to create/modify**:

- `scripts/migrate-purchase-orders.sql` (new)
- `src/lib/queries.ts` (add ~200 lines)
- `src/app/api/projects/[id]/purchase-orders/` (new)
- `src/app/(dashboard)/projects/[id]/purchase-orders/` (new)
- `src/app/(dashboard)/(vendor)/purchase-orders/` (new)
- `src/types/index.ts` (add types)
- `src/test/api/purchase-orders.test.ts` (new)

---

### Feature 14.5: Compare BOQ vs Order

**Goal**: Internal architect view that surfaces the delta between approved BOQ scope and what was actually ordered via POs. Catches over-orders, under-orders, and price drift before invoicing.

**Why slotted here**: Hard dependency on F14 (no POs → nothing to compare). Sits before F15 (vendor invoices) so the team can reconcile orders against scope before invoices come in.

**No new tables**. Pure presentation over the F4 `boq_item` and F14 `po_item` data. The `po_item.boq_item_id` link added in F14 is the join key.

**Data shape per row** (joined client-side from a single query):

```
boq_code · description · unit
boq_qty · po_qty · qty_delta · qty_delta_pct
boq_unit_price · po_unit_price · price_delta · price_delta_pct
boq_amount · po_amount · amount_delta
status: ordered_ok | over_ordered | under_ordered | not_ordered | price_mismatch
```

**Status derivation**:

- `not_ordered` → `boq_item.client_approval_status = 'approved'` AND no `po_item` linked
- `over_ordered` → `SUM(po_item.quantity) > boq_item.quantity`
- `under_ordered` → `SUM(po_item.quantity) < boq_item.quantity`
- `price_mismatch` → any `po_item.unit_price` differs from `boq_item.unit_cost` by > 1% (configurable threshold)
- `ordered_ok` → exact qty match AND no price mismatch

A single BOQ row may fan out to multiple PO items (split orders to different vendors); the compare view aggregates them and shows a "View POs (3)" affordance that drills into the breakdown.

**Queries** — extend `src/lib/queries/boq.ts`:

```ts
getBoqOrderComparison(projectId: string): Promise<BoqOrderComparisonRow[]>
```

Single query joining `boq_item` with `po_item` (LEFT JOIN, GROUP BY boq_item.id). Includes derived columns for deltas and status. Filters: only items with `client_approval_status = 'approved'` (unapproved items can't legitimately be ordered — F14 already enforces this).

**API Routes**:

- `GET /api/projects/[id]/boq/compare-with-orders` — returns the comparison rows, ordered by section then code

Optional query params: `?status=over_ordered,price_mismatch` to filter to just problematic rows.

**Auth**: `allowedRoles: ["pm", "architect"]`, `projectAccess: true`. Client does not see this view — they have F24 (Client Orders View) which is a different lens.

**UI** — new sub-route under the BOQ surface:

- `src/app/(dashboard)/projects/[id]/boq/compare/page.tsx` — full-page compare table.
- Top of page: summary cards — `Total approved`, `Total ordered`, `Variance`, `# items with issues`.
- Table columns: Code, Description, Unit, BOQ Qty, PO Qty, Δ Qty, BOQ Rate, PO Rate, Δ Rate, BOQ Total, PO Total, Δ Total, Status badge.
- Status badge color tones: green (`ordered_ok`), amber (`under_ordered`, `not_ordered`), red (`over_ordered`, `price_mismatch`).
- Row click → opens drawer with the breakdown of every PO item linked to that BOQ item (PO #, vendor, qty, unit price, status).
- Filter bar: status multi-select, section dropdown, search.
- Export: "Export to Excel" reuses `boqWriter.ts` patterns. PDF export deferred to F19.

**Action affordance**: From a `not_ordered` row → "Create RFQ for this item" (deep-link into F9 with the item pre-selected). From an `over_ordered` row → no automated fix (just surfaces the issue); the user navigates to the offending PO to amend it.

**Entry points**:

- `BoqHeader.tsx` action menu: add "Compare with Orders" item.
- Project detail page: add a sub-nav badge (e.g. on the BOQ tab) when there are ≥1 issues.
- F18 (BOQ Dashboard) widget: `Order variance` card showing total variance + count, links here.

**Files to create/modify**:

- `src/lib/queries/boq.ts` (add `getBoqOrderComparison`, ~80 lines)
- `src/app/api/projects/[id]/boq/compare-with-orders/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/boq/compare/page.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqCompareTable.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqCompareSummaryCards.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqComparePoBreakdownDrawer.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqHeader.tsx` (modify — action menu entry)
- `src/lib/api/routes.ts` (add route)
- `src/lib/api/boq.ts` (add wrapper)
- `src/types/index.ts` (`BoqOrderComparisonRow`)
- `messages/en.json`, `messages/tr.json` (add namespace `boq.compare.*`)
- `src/test/api/boq-compare.test.ts` (new)

**Open decisions**:

1. **Price-mismatch threshold**: 1% default. Make this org-configurable (org-level setting) or per-project? Default plan: per-org setting in F18 dashboard prefs.
2. **Cancelled POs**: include or exclude? Default plan: exclude — cancelled POs aren't a real order.
3. **Multi-currency**: if a PO is in a different currency than the BOQ, convert at PO `po_date` exchange rate or at compare-view time? Default plan: convert at PO date (locks the exchange rate to when the order was placed). Requires the FX-rate table from F-int-1.

---

### Feature 15: Vendor Invoices

**Goal**: Track vendor invoices against POs (vendor → org). Client-side invoicing lives in F22.

**Database** — `scripts/migrate-invoices.sql`:

```sql
CREATE TABLE invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','approved','disputed','paid','overdue')),
  payment_date DATE,
  pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoice_po ON invoice(po_id);
CREATE INDEX idx_invoice_vendor ON invoice(vendor_id);
```

**Invoice overdue check**: The `getInvoices()` query checks `due_date < NOW() AND status = 'received'` and auto-sets `status = 'overdue'` on read (check-on-read pattern, same as quote/proposal expiry).

**Approval gate** (per PRD tab 6 Rule 2): `POST /invoices` must reject if the invoice covers PO line items whose underlying `boq_item.client_approval_status ≠ 'approved'`. Same 422 response shape as F14's guard. The assumption is that F14 already blocks unapproved items from entering a PO — this is a belt-and-braces check in case a CO rollback leaves a PO pointing at a superseded item.

**API Routes**:

- `GET /api/projects/[id]/invoices` — list (architect view — all details)
- `POST /api/projects/[id]/invoices` — create
- `PATCH /api/projects/[id]/invoices/[invoiceId]` — update status
- `GET /api/projects/[id]/invoices/[invoiceId]` — detail

Client-facing invoice routes are in F22 (client invoices are a distinct entity; the client never sees vendor invoices).

**Files to create/modify**:

- `scripts/migrate-invoices.sql` (new)
- `src/lib/queries.ts` (add ~120 lines)
- `src/app/api/projects/[id]/invoices/` (new)
- `src/app/(dashboard)/projects/[id]/invoices/` (new)
- `src/types/index.ts` (add types)
- `src/test/api/invoices.test.ts` (new)
- `src/lib/queries/projectDocuments.ts` — re-add `{ name: "Invoices", icon: "Receipt" }` to `DEFAULT_DOCUMENT_SECTIONS`. It was removed when the RFQ/PO flow was still incomplete so the default section wouldn't sit empty; restore it here once vendor invoice PDFs have a home to land in.

---

### Feature 16: Progress Tracking

**Goal**: Track installation progress against BOQ items.

**What changes**:

- `boq_item.installed_qty` already exists from Feature 4
- Add API to update installed_qty (architect or future contractor role)
- Progress bar in BOQ table (already in UI from Feature 5, now with real data)
- Section-level and BOQ-level progress aggregation

**API Routes**:

- `PATCH /api/projects/[id]/boq/items/[itemId]/progress` — update installed_qty
- `GET /api/projects/[id]/boq/progress` — aggregated progress per section + overall

**UI**:

- Progress tab in project view (per PRD Table 43)
- Visual progress bars per section
- Overall project completion percentage

**Files to create/modify**:

- `src/lib/queries.ts` (add progress queries)
- `src/app/api/projects/[id]/boq/items/[itemId]/progress/route.ts` (new)
- `src/app/api/projects/[id]/boq/progress/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/progress/` (new)

---

### Feature 16.5: Vendor-Wise Scope View

**Goal**: Per-project, per-vendor lens over BOQ items + progress. The PM picks a vendor, sees every BOQ item that vendor is responsible for (via PO link), with quantity / order rate / amount / installed quantity / progress %. Mirrors RDash's Orders → Vendor-Wise Scope sub-tab.

**Why slotted here**: Hard dependency on F14 (POs link items to vendors) and F16 (progress data exists). Pure presentation feature — no new tables.

**Behaviour**:

- Each row = one `boq_item` that has at least one `po_item` linked, grouped by `vendor_id`.
- Columns: Code, Description, Status, Item Type, UOM, Order Qty, Order Rate, Amount, Installed Qty, Progress %.
- Vendor multi-select at the top; "All Vendors" by default. Filter UI mirrors `BoqSourceFilter` from F6.1 — URL-driven (`?vendor=<id>,<id>`).
- Summary cards above the table:
  - **Items**: total POs / total items
  - **Total Scope Amount**
  - **Overall Progress** (donut, from `installed_qty / quantity`)
  - **Today's Progress** (donut, items moved today)
- Sticky vendor section header with running vendor total; same chip-strip + section-footer pattern from F6.1.

**Queries** — extend `src/lib/queries/boq.ts`:

```ts
getVendorScopeForProject(
  projectId: string,
  vendorIds?: string[]
): Promise<VendorScopeRow[]>;

getVendorScopeSummary(
  projectId: string,
  vendorIds?: string[]
): Promise<{
  vendor_count: number;
  item_count: number;
  total_scope: string;
  overall_progress_pct: string;
  today_progress_pct: string;
}>;
```

Single LEFT JOIN of `boq_item ↔ po_item ↔ purchase_order ↔ vendor`, with progress computed as `installed_qty / NULLIF(quantity, 0) * 100`. Filtered to PO items whose `purchase_order.status NOT IN ('cancelled','draft')` so cancelled orders don't pollute the view.

**API Routes**:

- `GET /api/projects/[id]/boq/vendor-scope` — rows
- `GET /api/projects/[id]/boq/vendor-scope/summary` — cards

Optional query params: `?vendor=<id>` (comma-separated multi-select), `?status=in_progress,delivered`.

**Auth**: `allowedRoles: ["pm", "architect"]`, `projectAccess: true`. Vendor portal sees only their own vendor's scope (filter forced to their own vendor_id) — that's covered in F8.

**UI** — new sub-tab on the project's BOQ surface (sibling of `BoqTable`):

- `src/app/(dashboard)/projects/[id]/boq/vendor-scope/page.tsx` — full page
- Row click → opens `BoqItemDrawer` (existing component) with the linked PO summary inlined
- Vendor section header → "View vendor profile" link to F7's vendor detail page
- "Export to PDF" reuses F19 infra; defer if F19 isn't done yet

**Entry points**:

- `BoqHeader` action menu: "View by vendor"
- F18 (BOQ Dashboard) widget: "Top vendors by scope" card linking here
- Vendor detail page (F7): "Active scope on N projects" link to a multi-project version (defer)

**Files to create/modify**:

- `src/lib/queries/boq.ts` (add ~140 lines)
- `src/app/api/projects/[id]/boq/vendor-scope/route.ts` (new)
- `src/app/api/projects/[id]/boq/vendor-scope/summary/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/boq/vendor-scope/page.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/VendorScopeTable.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/VendorScopeSummaryCards.tsx` (new)
- `src/app/(dashboard)/projects/[id]/boq/_hooks/useVendorScopeFilter.ts` (new — mirror of `useBoqSourceFilter`)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqHeader.tsx` (modify — add menu entry)
- `src/lib/api/boq.ts` (add wrappers)
- `src/lib/api/routes.ts` (add routes)
- `src/types/index.ts` (`VendorScopeRow`, `VendorScopeSummary`)
- `messages/en.json`, `messages/tr.json` (`boq.vendorScope.*` namespace)
- `src/test/api/boq-vendor-scope.test.ts` (new)

**Open decisions**:

1. **Show items with no PO yet?** PM might want to see "approved BOQ items not yet assigned to a vendor". Default: no — the F14.5 Compare BOQ vs Order view already covers that lens. Vendor-Wise Scope is strictly "what the vendor owns".
2. **Cancelled POs**: exclude (consistent with F14.5 default).
3. **Multi-vendor PO**: a single PO is one vendor in F14's schema (`purchase_order.vendor_id`). No fan-out concern.

---

### Feature 16.6: Vendor DPR (Daily Progress Reports)

**Goal**: Vendor-side daily updates submitted from the vendor portal (manpower, blockers, tomorrow's plan, photos, projected completion). Architect dashboard surfaces these for project oversight. Mirrors RDash's Vendor-Wise Progress Report sub-tab.

**Why slotted here**: Depends on F8 (vendor role + portal — vendors need a login to submit), F14 (POs exist so vendors are linked to projects), F16 (progress concept). Heavier feature — new entity + new submission flow + new viewer.

**Database** — `scripts/migrate-vendor-dpr.sql`:

```sql
CREATE TABLE vendor_dpr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  reported_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  reported_progress_pct NUMERIC(5,2),
  projected_end_date DATE,
  -- Per-item status moves: [{ boq_item_id, from_status, to_status, qty_delta }, ...]
  todays_updates JSONB,
  -- Per-trade headcount: { "carpentry": 4, "electrical": 2, ... }
  manpower JSONB,
  blockers TEXT,
  tomorrows_plan TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Hard-prevent duplicate DPRs for the same vendor on the same day.
  UNIQUE (project_id, vendor_id, report_date)
);

CREATE TABLE vendor_dpr_photo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id UUID NOT NULL REFERENCES vendor_dpr(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption VARCHAR(255),
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vendor_dpr_project_date ON vendor_dpr(project_id, report_date DESC);
CREATE INDEX idx_vendor_dpr_vendor_date ON vendor_dpr(vendor_id, report_date DESC);
CREATE INDEX idx_vendor_dpr_photo_dpr ON vendor_dpr_photo(dpr_id, sort_order);
```

**Workflow**:

1. Vendor (logged in via F8) opens project from their portal → "Submit today's DPR" CTA.
2. Form: status moves picker (multi-select BOQ items they own + new status), manpower per trade, blockers, tomorrow's plan, projected end date, photos.
3. On submit, server validates `vendor_id` matches the user's vendor, validates `boq_item.id` ownership via `po_item`, optionally cascades the status moves into `boq_item.installed_qty` (reuses F16's progress update).
4. Architect view aggregates DPRs for the project, filterable by vendor + date range.

**Side-effect on submit**: when the DPR includes `todays_updates` with quantity deltas, server updates the linked `boq_item.installed_qty` in the same transaction. Otherwise the DPR is purely textual.

**Queries** — new file `src/lib/queries/vendorDpr.ts`:

- `createVendorDpr(input)` — vendor-only; rejects if `(project, vendor, date)` already exists (use the unique constraint)
- `getVendorDpr(id)` — single record with photos
- `listVendorDprs(projectId, filters)` — for architect view
- `listMyDprs(vendorId, projectId)` — for vendor portal
- `addDprPhoto(dprId, input)` — photo upload after DPR is created
- `updateVendorDpr(id, vendorId, fields)` — vendor can edit their own DPR until end-of-day; locked after

**API Routes**:

- `GET /api/projects/[id]/dpr` — architect list (filterable by vendor, date range)
- `GET /api/projects/[id]/dpr/[dprId]` — detail
- `POST /api/projects/[id]/dpr` — vendor submits
- `PATCH /api/projects/[id]/dpr/[dprId]` — vendor edits (until end-of-day)
- `POST /api/projects/[id]/dpr/[dprId]/photos` — add photo
- `DELETE /api/projects/[id]/dpr/[dprId]/photos/[photoId]` — remove photo
- `GET /api/projects/[id]/dpr/export?vendor=<id>&from=<date>&to=<date>&format=pdf` — export

**Auth**:

- POST/PATCH: `vendor` role only, scoped to their `vendor_id`.
- GET architect list: `pm`, `architect`, `projectAccess: true`.
- GET vendor's own list: `vendor`, scoped to own `vendor_id`.

**UI**:

- **Vendor portal** — `src/app/(dashboard)/(vendor)/projects/[id]/dpr/`:
  - "Today's DPR" form (one per day, edit until midnight)
  - Past DPRs list (read-only)
- **Architect view** — new sub-tab in BOQ surface: "Vendor Wise Progress Report":
  - Vendor multi-select + date range picker
  - Timeline list of DPRs (one per vendor per day)
  - Each card shows the four sections: Today's Updates, Manpower, Blockers, Tomorrow's Plan, Photos, Reported Progress %, Projected End Date
  - "Export Today's Progress" / "Export Complete Report" actions (PDF, reuses F19)

**Notifications**: when a vendor submits a DPR with a `blockers` value, notify the project's PM + Architect immediately. Reuses existing notification infra.

**Files to create/modify**:

- `scripts/migrate-vendor-dpr.sql` (new)
- `src/lib/queries/vendorDpr.ts` (new ~280 lines)
- `src/app/api/projects/[id]/dpr/route.ts` (new — list + create)
- `src/app/api/projects/[id]/dpr/[dprId]/route.ts` (new — get + patch)
- `src/app/api/projects/[id]/dpr/[dprId]/photos/route.ts` (new)
- `src/app/api/projects/[id]/dpr/[dprId]/photos/[photoId]/route.ts` (new)
- `src/app/api/projects/[id]/dpr/export/route.ts` (new)
- `src/app/(dashboard)/(vendor)/projects/[id]/dpr/page.tsx` (new)
- `src/app/(dashboard)/(vendor)/projects/[id]/dpr/_components/*.tsx` (new — DprForm, DprList, DprCard)
- `src/app/(dashboard)/projects/[id]/boq/dpr/page.tsx` (new — architect viewer)
- `src/app/(dashboard)/projects/[id]/boq/_components/VendorDprCard.tsx` (new)
- `src/lib/api/vendorDpr.ts` (new)
- `src/lib/api/routes.ts` (add)
- `src/lib/validations.ts` (add `vendorDprSchema`, `vendorDprPhotoSchema`)
- `src/types/index.ts` (`VendorDpr`, `VendorDprPhoto`, `Manpower`)
- `messages/en.json`, `messages/tr.json` (add `dpr.*` namespace)
- `src/test/api/vendor-dpr.test.ts` (new)

**Open decisions**:

1. **Edit window**. RDash treats DPRs as immutable after submission. We propose vendor-can-edit-until-midnight to handle typo fixes; afterwards locked. Audit log records the original + edits via F21.
2. **Auto-cascade quantities into `boq_item.installed_qty`?** Default: yes, with a confirmation prompt on the vendor form ("This will update installed quantities by N units"). Vendor sees the impact before submit. Architect can override later via F16.
3. **Required fields**. Manpower + reported_progress_pct should be required; blockers + tomorrow's plan optional. Bias toward catching missing structured data.
4. **Photo limits**. Max 20 photos per DPR, 5 MB each — same as F-EL-3 image upload constraints.

---

### Feature 17: Snag Management

**Goal**: Link quality snags to BOQ items.

**Database** — `scripts/migrate-snags.sql`:

```sql
CREATE TABLE snag (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  boq_item_id UUID REFERENCES boq_item(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'medium'
    CHECK (severity IN ('low','medium','high','critical')),
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  reported_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES "user"(id) ON DELETE SET NULL,
  photo_urls JSONB,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_snag_project ON snag(project_id);
CREATE INDEX idx_snag_boq_item ON snag(boq_item_id);
```

**Auto-flag**: When a snag is created for a BOQ item, set `boq_item.has_snag = true`. When all snags for that item are resolved, set back to false.

**API Routes**:

- `GET /api/projects/[id]/snags` — list with filters
- `POST /api/projects/[id]/snags` — create snag
- `PATCH /api/projects/[id]/snags/[snagId]` — update
- `GET /api/projects/[id]/snags/[snagId]` — detail

**Files to create/modify**:

- `scripts/migrate-snags.sql` (new)
- `src/lib/queries.ts` (add ~150 lines)
- `src/app/api/projects/[id]/snags/` (new)
- `src/app/(dashboard)/projects/[id]/snags/` (new)
- `src/types/index.ts` (add types)
- `src/test/api/snags.test.ts` (new)

---

### Feature 18: BOQ Dashboard Widgets

**Goal**: Project dashboard with BOQ-specific analytics.

**Widgets** (per PRD):

- Margin bleed items (count + drill-down)
- Budget cap alerts per section
- Cost breakdown by section (pie/bar chart)
- Progress overview per section
- Outstanding client approvals
- Open snags count
- PO status summary

**New dependency**: `recharts` (charts)

**API Routes**:

- `GET /api/projects/[id]/boq/dashboard` — aggregated widget data

**UI**: Dashboard cards + charts on project overview page

**Files to create/modify**:

- `package.json` (add `recharts`)
- `src/lib/queries.ts` (add dashboard aggregation queries)
- `src/app/api/projects/[id]/boq/dashboard/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/_components/BoqDashboard.tsx` (new)
- `src/app/(dashboard)/dashboard/` (update main dashboard with BOQ overview)

---

### Feature 19: PDF Export

**Goal**: Generate professional PDFs for BOQ, proposals, POs, change orders.

**New dependency**: `@react-pdf/renderer`

**PDFs**:

- BOQ PDF (architect view — all columns)
- BOQ PDF (client view — no cost/margin, only sell price)
- Client proposal PDF (cover letter + BOQ summary + terms)
- PO PDF (vendor-facing)
- Change order PDF

**API Routes**: Extend existing export endpoints to generate PDFs via `@react-pdf/renderer`

**Files to create/modify**:

- `package.json` (add `@react-pdf/renderer`)
- `src/lib/pdf/boq-pdf.tsx` (new)
- `src/lib/pdf/proposal-pdf.tsx` (new)
- `src/lib/pdf/po-pdf.tsx` (new)
- `src/lib/pdf/change-order-pdf.tsx` (new)
- Update existing export API routes

---

### Feature 20: Custom Tabs

**Goal**: Per-project custom tabs (rich text, table, document, timeline, Q&A).

**New dependency**: `tiptap` (evaluate lightweight alternatives first)

**Database** — `scripts/migrate-custom-tabs.sql`:

```sql
CREATE TABLE project_custom_tab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  tab_type VARCHAR(20) NOT NULL
    CHECK (tab_type IN ('rich_text','table','document','milestone','qa')),
  content JSONB,
  sort_order INTEGER DEFAULT 0,
  is_visible_to_client BOOLEAN DEFAULT true,
  created_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Tab types** (per PRD Table 30):

- Rich Text: TipTap editor
- Table: Custom column definitions + data entry
- Document: File upload with versions
- Milestone Timeline: Gantt-style timeline
- Q&A: Threaded comments

**Files to create/modify**:

- `scripts/migrate-custom-tabs.sql` (new)
- `src/lib/queries.ts` (add ~100 lines)
- `src/app/api/projects/[id]/custom-tabs/` (new)
- `src/app/(dashboard)/projects/[id]/custom-tabs/` (new)

---

### Feature 21: Audit Trail

**Goal**: Full audit trail for all BOQ mutations.

**Database** — `scripts/migrate-boq-audit.sql`:

```sql
CREATE TABLE boq_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_item_id UUID REFERENCES boq_item(id) ON DELETE SET NULL,
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
  change_type VARCHAR(30) NOT NULL
    CHECK (change_type IN ('created','updated','deleted','approved','rejected','progress_update','snag_linked')),
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  change_order_id UUID REFERENCES change_order(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_boq_log_boq ON boq_change_log(boq_id);
CREATE INDEX idx_boq_log_item ON boq_change_log(boq_item_id);
CREATE INDEX idx_boq_log_time ON boq_change_log(created_at);
```

**Implementation**: Add logging calls to all BOQ mutation queries (create/update/delete item, approve, progress update). This is a cross-cutting concern — retroactively add to existing BOQ queries.

**API Routes**:

- `GET /api/projects/[id]/boq/audit` — paginated audit log with filters (date range, change type, user)

**UI**: Audit tab in BOQ page showing timeline of all changes.

**Auth**: `allowedRoles: ["pm", "architect"]` — never shown to client or vendor.

**Files to create/modify**:

- `scripts/migrate-boq-audit.sql` (new)
- `src/lib/queries.ts` (add audit logging to existing queries + audit read queries)
- `src/app/api/projects/[id]/boq/audit/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/BoqAuditLog.tsx` (new)

---

### Feature 22: Client Invoices

**Goal**: Issue invoices from the org to the client against approved + delivered BOQ scope. Distinct from F15 vendor invoices. Introduced by PRD tab 5 ("Client invoices") and tab 6 Phase 9.

**Database** — `scripts/migrate-client-invoices.sql`:

```sql
CREATE TABLE client_invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE RESTRICT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','partially_paid','paid','overdue','cancelled')),
  issued_date DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  contingency_amount NUMERIC(12,2) DEFAULT 0,
  vat_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes TEXT,
  pdf_url TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE client_invoice_line (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_invoice_id UUID NOT NULL REFERENCES client_invoice(id) ON DELETE CASCADE,
  boq_item_id UUID NOT NULL REFERENCES boq_item(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_client_invoice_project ON client_invoice(project_id);
CREATE INDEX idx_client_invoice_boq ON client_invoice(boq_id);
CREATE INDEX idx_client_invoice_status ON client_invoice(status);
CREATE INDEX idx_client_invoice_line_invoice ON client_invoice_line(client_invoice_id);
CREATE INDEX idx_client_invoice_line_boq_item ON client_invoice_line(boq_item_id);
```

**Numbering**: `INV-{YEAR}-{SEQ}` via `getNextSequenceNumber(orgId, "INV")` from F4.

**Approval gate** (tab 6 Rule 2): `POST /client-invoices` must reject if any referenced `boq_item.client_approval_status ≠ 'approved'`. Return 422 with the same `{ error, code: "UNAPPROVED_BOQ_ITEMS", itemCodes: [...] }` shape as F14 / F15.

**Overdue check-on-read**: same pattern as vendor invoice — `due_date < NOW() AND status IN ('sent','viewed','partially_paid')` auto-flips to `overdue` on read.

**Amount reconciliation**: `amount_paid` is maintained by F23 triggers; `status` auto-updates to `partially_paid` / `paid` as payments come in.

**API Routes**:

- `GET /api/projects/[id]/client-invoices` — list (architect view)
- `POST /api/projects/[id]/client-invoices` — create (with approval gate)
- `GET /api/projects/[id]/client-invoices/[invoiceId]` — detail
- `PATCH /api/projects/[id]/client-invoices/[invoiceId]` — update (draft only)
- `POST /api/projects/[id]/client-invoices/[invoiceId]/send` — issue to client
- `POST /api/projects/[id]/client-invoices/[invoiceId]/cancel` — cancel
- `GET /api/client/projects/[id]/invoices` — client-facing list
- `GET /api/client/projects/[id]/invoices/[invoiceId]` — client-facing detail + PDF

**UI**: New "Client Invoices" tab inside the BOQ tab (architect) + "Client Invoices" sub-page in client portal (F12).

**Auth**: Architect writes, client reads. `allowedRoles: ["pm", "architect"]` for mutation; `allowedRoles: ["client"]` for `/api/client/...`.

**Files to create/modify**:

- `scripts/migrate-client-invoices.sql` (new)
- `src/lib/queries/clientInvoices.ts` (new, ~150 lines)
- `src/app/api/projects/[id]/client-invoices/` (new)
- `src/app/api/client/projects/[id]/invoices/` (new — client-facing)
- `src/app/(dashboard)/projects/[id]/boq/_components/ClientInvoicesPanel.tsx` (new)
- `src/app/(dashboard)/projects/[id]/_components/ClientInvoicesTab.tsx` (new — client portal surface)
- `src/types/index.ts` (add types)
- `src/lib/validations.ts` (add schemas)
- `src/lib/api/clientInvoices.ts` (new)
- `src/lib/api/routes.ts` (add routes)
- `src/test/api/client-invoices.test.ts` (new)

---

### Feature 23: Client Payments

**Goal**: Track payments received from the client against F22 client invoices. Tab 5 calls this "Payment from client".

**Database** — `scripts/migrate-client-payments.sql`:

```sql
CREATE TABLE client_payment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  client_invoice_id UUID REFERENCES client_invoice(id) ON DELETE SET NULL,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method VARCHAR(30) NOT NULL
    CHECK (method IN ('bank_transfer','cheque','card','cash','other')),
  reference VARCHAR(255),
  notes TEXT,
  attachment_url TEXT,
  recorded_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_payment_project ON client_payment(project_id);
CREATE INDEX idx_client_payment_invoice ON client_payment(client_invoice_id);
CREATE INDEX idx_client_payment_date ON client_payment(payment_date);
```

**Numbering**: `PAY-{YEAR}-{SEQ}` via `getNextSequenceNumber(orgId, "PAY")`.

**Invoice reconciliation**: Inserting / updating / deleting a `client_payment` triggers recomputation of the parent `client_invoice.amount_paid` and a status update: `paid` if fully covered, `partially_paid` if > 0 and < total. Implemented via a DB trigger or (simpler) a single transaction in the query layer — prefer query layer for consistency with existing code style.

**Unallocated payments**: Allow `client_invoice_id` to be NULL for advance / on-account payments. These are visible on the payments list but don't reconcile a specific invoice until an architect links them.

**API Routes**:

- `GET /api/projects/[id]/client-payments` — list
- `POST /api/projects/[id]/client-payments` — record payment
- `PATCH /api/projects/[id]/client-payments/[paymentId]` — edit (reason required for audit)
- `DELETE /api/projects/[id]/client-payments/[paymentId]` — void (with reason)
- `GET /api/client/projects/[id]/payments` — client-facing list (read-only)

**Auth**: Architect writes; client reads own project's payments. Deletions are never hard-destructive — either mark `voided` or append a negative offsetting row (decide during F23 build).

**UI**: "Payments" sub-page in both architect BOQ tab and client portal.

**Files to create/modify**:

- `scripts/migrate-client-payments.sql` (new)
- `src/lib/queries/clientPayments.ts` (new, ~120 lines)
- `src/app/api/projects/[id]/client-payments/` (new)
- `src/app/api/client/projects/[id]/payments/` (new)
- `src/app/(dashboard)/projects/[id]/boq/_components/PaymentsPanel.tsx` (new)
- `src/app/(dashboard)/projects/[id]/_components/PaymentsTab.tsx` (new)
- `src/types/index.ts` (add types)
- `src/lib/validations.ts` (add schemas)
- `src/lib/api/clientPayments.ts` (new)
- `src/lib/api/routes.ts` (add routes)
- `src/test/api/client-payments.test.ts` (new)

---

### Feature 24: Client Orders View

**Goal**: Read-only "order log" for the client — the list of BOQ items they have approved, presented as confirmed orders. Tab 5 calls this "Client orders". No new DB — this is a presentation feature over existing F4/F12 data.

**Behaviour**:

- Shows each BOQ item where `client_approval_status = 'approved'`, grouped by approval date (most recent first)
- Columns: Item code, description, unit, quantity, proposed price, approved-on date, status chip (Ordered / In Progress / Delivered / Invoiced — derived from `po_status`, `installed_qty`, and F22 invoice linkage)
- Clicking a row deep-links into the BOQ item drawer (same drawer as F12 "Scope")
- No mutations — purely a different slice of the same data

**API Routes**:

- `GET /api/client/projects/[id]/orders` — returns approved items with derived status chips, ordered by `client_approved_at DESC`

**UI**: New "Orders" sub-page in client portal, alongside Scope / Proposals / Client Invoices / Payments.

**Files to create/modify**:

- `src/app/api/client/projects/[id]/orders/route.ts` (new)
- `src/app/(dashboard)/projects/[id]/_components/OrdersTab.tsx` (new)
- `src/lib/api/clientOrders.ts` (new)
- `src/lib/api/routes.ts` (add route)
- `src/lib/queries/boq.ts` (add `getApprovedItemsForClient(projectId)` query)
- `src/test/api/client-orders.test.ts` (new)

---

## Dependency Graph

```
F1 (Categories) ──→ F2 (Elements) ──→ F3 (Excel Import)
                         │
                         ▼
                    F4 (BOQ Core) ──→ F5 (BOQ UI) ──→ F6 (BOQ Excel) ──→ F6.1 (Table Enhancements)
                         │                │
                         │                ▼
                         │           F12 (Client BOQ Portal)
                         │                │
                         │                ▼
                         │           F13 (Locking + Change Orders)
                         │
                         ▼
                    F7 (Vendors) ──→ F7.1 (KYC Docs) ──→ F7.5 (Rate Contracts) ──→ F8 (Vendor Role) ──→ F9 (RFQ) ──→ F10 (Quotes)
                                                                                                       │
                                                                                                       ▼
                                                                                                  F11 (Proposals)
                                                                                                       │
                                                                                                       ▼
                                                                                                  F14 (POs) ──→ F14.5 (Compare BOQ vs Order) ──→ F15 (Invoices)

F6.1 (BOQ Table Enhancements) — shipped PR #81
F16 (Progress) — depends on F4 (BOQ items exist)
F16.5 (Vendor-Wise Scope) — depends on F4, F14, F16
F8.5 (Vendor Self-Service Profile) — depends on F8, F7, F7.1
F16.6 (Vendor DPR) — depends on F8 (vendor portal), F14, F16
F17 (Snags) — depends on F4 (BOQ items exist)
F18 (Dashboard) — depends on F4, F16, F17, F14.5, F16.5
F19 (PDF Export) — depends on F4, F11, F14, F13, F16.6
F20 (Custom Tabs) — standalone, can go anywhere after F4
F21 (Audit Trail) — depends on F4, best added after F13
F22 (Client Invoices) — depends on F4, F12 (client portal surface)
F23 (Client Payments) — depends on F22
F24 (Client Orders) — depends on F4, F12
```

## Estimated Scope per Feature

| #    | Feature         | New Files | queries.ts Lines | API Routes | Complexity |
| ---- | --------------- | --------- | ---------------- | ---------- | ---------- |
| 1    | Categories      | ~10       | ~100             | 5          | Low        |
| 2    | Elements CRUD   | ~15       | ~200             | 6          | Medium     |
| 3    | Excel Import    | ~8        | ~50              | 3          | Medium     |
| 4    | BOQ Core        | ~16       | ~450             | 13         | High       |
| 5    | BOQ UI          | ~12       | 0                | 0          | High       |
| 6    | BOQ Excel       | ~6        | ~50              | 3          | Medium     |
| 6.1  | BOQ Table Enh.  | ~3        | ~80              | 0          | Medium     |
| 7    | Vendors         | ~14       | ~220             | 8          | Medium     |
| 7.1  | Vendor KYC      | ~8        | ~120             | 4          | Low        |
| 7.5  | Rate Contracts  | ~16       | ~250             | 8          | Medium     |
| 8    | Vendor Role     | ~6        | ~30              | 0          | Low        |
| 8.5  | Vendor Profile  | ~8        | ~90              | 5          | Low        |
| 9    | RFQ             | ~12       | ~200             | 7          | High       |
| 10   | Quotes          | ~10       | ~220             | 7          | High       |
| 11   | Proposals       | ~10       | ~200             | 11         | Medium     |
| 12   | Client BOQ      | ~8        | ~100             | 4          | Medium     |
| 13   | Locking + CO    | ~12       | ~300             | 10         | High       |
| 14   | POs             | ~10       | ~200             | 7          | Medium     |
| 14.5 | BOQ vs Order    | ~7        | ~80              | 1          | Medium     |
| 15   | Invoices        | ~8        | ~120             | 6          | Low        |
| 16   | Progress        | ~5        | ~80              | 2          | Low        |
| 16.5 | Vendor Scope    | ~13       | ~140             | 2          | Medium     |
| 16.6 | Vendor DPR      | ~14       | ~280             | 7          | High       |
| 17   | Snags           | ~8        | ~150             | 4          | Medium     |
| 18   | Dashboard       | ~5        | ~100             | 1          | Medium     |
| 19   | PDF Export      | ~8        | 0                | 4          | Medium     |
| 20   | Custom Tabs     | ~8        | ~100             | 4          | Medium     |
| 21   | Audit Trail     | ~4        | ~80              | 1          | Low        |
| 22   | Client Invoices | ~10       | ~150             | 8          | Medium     |
| 23   | Client Payments | ~8        | ~120             | 5          | Low        |
| 24   | Client Orders   | ~6        | ~30              | 1          | Low        |

**Total**: ~30 PRs, ~275 new files, ~4,150 new lines in queries, ~137 new API routes (including F6.1, F7.1, F7.5, F14.5, F16.5, F16.6)

---

## Phase 2 (Future — Not in This Plan)

Per PRD Table 57, these are explicitly deferred:

- **Contractor role** — field team progress logging, daily reports
- **Material deliveries** — delivery tracking linked to POs
- **Retention ledger** — financial retention management
- **Supabase Realtime** — live updates (currently SWR polling is sufficient)

The PRD recommends creating empty Phase 2 tables in the initial migration. We'll skip this — we'll create tables when we need them. No premature schema.

---

## Notes

1. **Migration strategy**: Each feature's migration is a standalone SQL file run manually via `psql`. No migration framework. Same pattern as existing `scripts/migrate-*.sql` files.

2. **Feature flags**: New modules gated behind `features.ts` flags. Toggle on per-feature when shipping.

3. **Testing**: Every new API route gets a test file. Every new Zod schema gets validation tests. Follow existing patterns in `src/test/`.

4. **i18n**: All new UI strings go through `next-intl`. Add keys to both `en` and `tr` message files.

5. **No breaking changes**: Existing functionality (design review, tasks, notifications) is untouched. New features are additive.
