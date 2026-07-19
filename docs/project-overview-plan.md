# Project Overview page — Implementation Plan

## Context

Today `/projects/[id]` just `redirect`s to `/designs`, so **Designs is the accidental
home** of every project even though it's a peer of BOQ and Order. And a tall `MetaBar`
metadata card sits **above every tab**, pushing the actual working content down.

This restructures the project detail page: **Overview becomes the project home**, the
working tabs sit at the top (`Overview · Design · BOQ · Order`), and the project metadata
moves off the top of every tab into Overview — which becomes a real dashboard (KPIs,
charts, details, activity, team). Design approved in `prejoin-redesigns.pen` (PM view;
client + vendor variants designed alongside).

**Delivery:** one PR on `feat/project-overview` (off `main`). Supersedes the compact-meta-bar
work in **#218** (that removed metadata's height; this removes it from the top flow entirely) —
close #218 and port only its detail-field content onto the Overview details card. No schema
change.

## 1. Routing & layout restructure

| File | Change |
|---|---|
| `projects/[id]/page.tsx` | Stop redirecting to `/designs`; render **Overview** (the project home). Overview lives at the index route `/projects/[id]`. |
| `_components/ProjectWorkflowSteps.tsx` | Add **Overview** as the first tab → `href = /projects/${id}`, active on the index route (a leading tab, not a workflow step). |
| `projects/[id]/layout.tsx` | **Remove `MetaBar`** from the shared chrome (+ its `showMetaBar` gate). Every tab renders its content directly under the tab strip. |
| `_components/MetaBar.tsx` | Delete once unused (its detail fields move to the Overview details card; client-variant info moves to the client Overview). |

## 2. Overview data — one aggregation endpoint

| File | Change |
|---|---|
| `src/lib/queries/projectOverview.ts` (new) | `getProjectOverview(projectId, role)` — server-aggregates, **role-scoped**: KPI counts (design files, pending reviews, BOQ value + line count, open orders/RFQs), **design-status breakdown** (counts by `review_status` → donut), **cost by division** (roll up `boq_item → boq_section → division`), and **recent activity** (recent uploads / reviews / `audit_event`). Client/vendor variants return only their permitted slice. |
| `api/projects/[id]/overview/route.ts` (new) | `GET`, `projectAccess`; role derived server-side. |
| `lib/api/routes.ts` + wrapper + `hooks/useProjectOverview.ts` (new) | Typed SWR fetch. |

## 3. Overview page + components

| File | Change |
|---|---|
| `_components/OverviewTab.tsx` (new) | Dashboard: KPI row → charts row → details + activity/team, per the `.pen`. **Role-gated** rendering (PM / client / vendor variants — see §5). |
| `_components/overview/` (new) | `KpiCard`, `ProjectDetailsCard` (reuses the metadata fields), `ActivityFeed`, `TeamList`. |
| `components/ui/DonutChart.tsx` + `BarChart.tsx` (new) | **Library-free** reusable charts (SVG ring via `stroke-dasharray`; flex bars) — no chart dependency added, matching the app's ethos. Respect `prefers-reduced-motion` if animated. |

## 4. Cross-cutting

- **i18n**: Overview labels (en + tr) — parity test.
- **Tests**: API test for `/overview` + `getProjectOverview` (unit); DOM tests for `DonutChart`/`BarChart`; fix any layout/MetaBar tests affected by removal.
- Reuse `avatarColor` / `deriveInitials`; `next/image` for avatars where applicable.

## 5. Role variants (designed in `prejoin-redesigns.pen`)

Grounded in the role-visibility audit:

- **PM / Architect** — the full dashboard: KPIs (design files, pending reviews, BOQ value,
  open orders), a design-status donut, a **cost-by-division** bar chart, project details,
  recent activity, team. *(Frame: "Project Overview — Page".)*
- **Client** — review-centric project Overview. **Tabs are `Overview · Design · BOQ`
  (no Order — studio-only).** A "**N items awaiting your approval**" CTA banner, KPIs
  (awaiting-your-review, approved-by-you, files-shared, **proposed value only**), a
  "your review progress" donut, a per-phase **design-progress** bar set, client-safe
  details (**no unit cost / margin / budget / internal estimate**), client-relevant
  activity, and a "your team" contact list. *(Frame: "Client Overview — Page".)*
- **Vendor — NOT part of this PR.** The audit is decisive: `hasProjectAccess` returns
  **false for vendors**, so they cannot load `/api/projects/[id]/*` or the project page at
  all — they live entirely in the `(vendor)` portal. A *per-project* vendor overview isn't a
  real thing. Their "overview" is a **cross-project portfolio dashboard** (open RFQs,
  quotes under review, active POs, pending invoices; a quote-outcomes donut + awarded-value
  chart; an "RFQs awaiting your response" table). It's a **separate surface** (the vendor
  portal home, currently feature-flagged/coming-soon) — designed for reference, tracked as
  a **follow-up**, out of scope here. *(Frame: "Vendor Dashboard — Page".)*

**This PR ships the PM + Client project Overviews only.**

## Risks / decisions

1. **`MetaBar` removal touches the client view** — the current client-variant inline bar
   (status/category/deadline/members) must reappear on the client Overview.
2. **Cost-by-division** — `BoqSummary` is per-section; the endpoint must roll sections up
   to divisions (extra join).
3. **Vendor scope — resolved.** Vendors have no project access (`hasProjectAccess`=false),
   so they get no project Overview. The vendor portfolio dashboard is a separate follow-up,
   not this PR.

## Verification

- `npm run check` + `npm run test:all`; no migration.
- Manual: open a project → lands on Overview with tabs on top; Design/BOQ/Order show content
  directly under the tab strip (no meta card); charts + KPIs render; client and vendor roles
  each see only their permitted view.
