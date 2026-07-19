# Project Overview page — Implementation Plan

## Context

Today `/projects/[id]` just `redirect`s to `/designs`, so **Designs is the accidental home**
of every project even though it's a peer of BOQ and Order. And a tall `MetaBar` metadata card
sits **above every tab**, pushing the actual working content down.

This restructures the project detail page:

- **Overview becomes the project home** (`/projects/[id]` stops redirecting).
- The working tabs sit at the top: **`Overview · Design · BOQ · Order`** (client: no Order).
- The project metadata moves **off the top of every tab** into Overview, which becomes a real
  dashboard — KPIs, charts, details, activity, team.

Design approved in `prejoin-redesigns.pen`: **"Project Overview — Page"** (PM) and
**"Client Overview — Page"** (client). Header carries the existing `Settings` + `Documents →`
pills; the tab strip is the app's real `ProjectWorkflowSteps` bar with an **Overview** tab prepended.

**Delivery:** one PR on `feat/project-overview` (off `main`). No schema change.
Supersedes **#218** (compact meta bar) — that reduced the meta card's height; this removes it from
the top flow entirely. **Close #218** and port only its detail-field content onto the Overview
details card.

**Scope:** PM + Client project Overviews only. The **vendor** portfolio dashboard is a separate
follow-up — vendors have `hasProjectAccess === false`, cannot load `/api/projects/[id]/*`, and live
entirely in the `(vendor)` portal, so a per-project overview isn't a real surface for them. (Designed
in `.pen` as "Vendor Dashboard — Page" for later.)

---

## 1. Routing & layout restructure

| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `projects/[id]/page.tsx`                              | Stop `redirect(...→/designs)`. Render `<OverviewTab projectId={id} />` (client component). Overview lives at the index route `/projects/[id]`.                                                                                                                                                                                                                                                                                                               |
| `_components/ProjectTabs.tsx` (`useActiveProjectTab`) | Add `"overview"` to `ProjectTab`. Return `"overview"` when `pathname === /projects/${projectId}` (exact). Keep `designs`/`boq`/`order` prefixes; **`designs` is no longer the fallback for the bare index route.**                                                                                                                                                                                                                                           |
| `_components/ProjectWorkflowSteps.tsx`                | Prepend an **Overview** step: `href = /projects/${projectId}`, `id: "overview"`, rendered with a `LayoutDashboard` icon instead of a status dot (it's a landing tab, not a workflow stage). Active state uses the same `bg-accent/10` + `font-semibold text-accent` treatment. Everything else (Design/BOQ/Order dots, chevrons, stagger) unchanged.                                                                                                         |
| `projects/[id]/layout.tsx`                            | (a) Add `pathname === base` to **`showWorkflowSteps`** so the tab strip renders on Overview. (b) **Remove `MetaBar`** — delete the import, the `<MetaBar/>` render, and the `showMetaBar` gate. (c) Keep `showComments` but drop it on the index route (`&& pathname !== base`) — Overview has its own activity feed; the comments strip stays on design/BOQ. (d) `metaSurface` stays only as the input to `showComments`; inline it if that's its last use. |
| `_components/MetaBar.tsx`                             | **Delete** (single consumer). PM detail fields → Overview `ProjectDetailsCard`; client-variant fields (status/category/deadline/members) → client Overview.                                                                                                                                                                                                                                                                                                  |

**Header pills** (`Settings`, `Documents →`) already live in `layout.tsx`'s `headerActions` — no change;
the `.pen` design just reflects them.

---

## 2. Overview data — one aggregation endpoint

| File                                                                              | Change                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/queries/projectOverview.ts` (new)                                        | `getProjectOverview(executor, projectId, role, viewerEmail?)` — server-aggregates, **role-scoped**, returns one `ProjectOverview` bundle. Reuses existing queries where possible (no new SQL where an existing helper fits). |
| `api/projects/[id]/overview/route.ts` (new)                                       | `GET`, wrapped with `withAuth({ projectAccess: true })`. Role derived server-side via the same `deriveEffectiveRole` the layout uses; pass it + viewer email into the query. Client gets the cost-scrubbed slice.            |
| `lib/api/routes.ts` + `lib/api/projects.ts` + `hooks/useProjectOverview.ts` (new) | `API.projectOverview(id)` builder, typed wrapper, `useSWR<ProjectOverview>` hook.                                                                                                                                            |
| `types/index.ts`                                                                  | `ProjectOverview`, `OverviewKpi`, `ChartSegment`, `ActivityItem` types.                                                                                                                                                      |

### Data sources (reuse, don't re-query)

| Bundle field                  | Source                                                                                                                                                                                                           | Role scoping                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `kpis.designFiles`            | distinct `version_group` count on `attachment` for the project                                                                                                                                                   | client: only `sent_to_client_at IS NOT NULL`                                                      |
| `kpis.pendingReviews`         | PM: attachments in `review_status = 'pending'`. Client: files shared-but-not-yet-decided (existing client-pending logic).                                                                                        | per role                                                                                          |
| `kpis.boqValue` + `lineCount` | `BoqSummary` (existing)                                                                                                                                                                                          | PM: `total_sell_price`; client: `client_total` (scrubbed)                                         |
| `kpis.openOrders`             | RFQ count (existing `useRfqList` total / a count query)                                                                                                                                                          | **PM/architect only** — omitted for client                                                        |
| `designStatus` (donut)        | counts by `attachment.review_status` (approved / pending / rejected / draft)                                                                                                                                     | client: their decision buckets (approved-by-you / awaiting / changes-requested) over shared files |
| `chart` (bars)                | PM: **cost by division** — roll `boq_item → boq_section → division`, sum sell price per division. Client: **design progress by phase** — % approved per phase from `getAttachmentPhaseCounts` + approved counts. | per role                                                                                          |
| `activity`                    | recent project events — union of recent uploads + `attachment_review` decisions (+ `audit_event` if cheap), newest 6–8                                                                                           | client: only client-relevant events (shared / approved), never internal                           |
| `details`                     | project row + members (client/pm/architect names, created, location, scope, area, estimate)                                                                                                                      | client: **no unit cost / margin / budget / internal estimate**                                    |
| `team`                        | `project.members`                                                                                                                                                                                                | client: "your team" (studio contacts)                                                             |

**Cost-by-division roll-up** is the one genuinely new query: `BoqSummary` is per-section, so join
`boq_section.division` and `GROUP BY division`. One extra query beside the summary.

---

## 3. Overview page + components

| File                                          | Change                                                                                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_components/OverviewTab.tsx` (new)           | `"use client"`. `useUserRole()` + `useProjectOverview(projectId)`. Renders the PM layout or the client layout (below). Owns its **skeleton** from `isLoading` (no route `loading.tsx`). Staggers sections via `useLoadStagger`.                   |
| `_components/overview/KpiCard.tsx`            | label + value + icon + colored sub-line. (Matches `.pen` "Metric Card".)                                                                                                                                                                          |
| `_components/overview/ProjectDetailsCard.tsx` | the metadata fields from the deleted `MetaBar` (PM: client/PMs/architects/created/location/scope/area/estimate; client: status/category/deadline, **no costs**).                                                                                  |
| `_components/overview/ActivityFeed.tsx`       | icon + text + relative time rows (reuse `formatDate` / a relative-time helper).                                                                                                                                                                   |
| `_components/overview/TeamList.tsx`           | avatar (`avatarColor` + `deriveInitials`) + name + role.                                                                                                                                                                                          |
| `_components/overview/ReviewBanner.tsx`       | **client only** — "N items awaiting your approval" + CTA to Design. Hidden when 0.                                                                                                                                                                |
| `components/ui/DonutChart.tsx` (new)          | **Library-free** donut. `segments: {label,value,color}[]`, optional center value/label + legend. CSS `conic-gradient` ring + masked center (no SVG-arc math, no dependency). Respect `prefers-reduced-motion` (no draw-in animation, or gate it). |
| `components/ui/BarChart.tsx` (new)            | **Library-free** horizontal labeled bars (flex + `width %`). Serves both cost-by-division (value bars) and per-phase progress (percent bars).                                                                                                     |

### PM layout (per `.pen` "Project Overview — Page")

KPI row (4 `KpiCard`: design files · pending reviews · BOQ value · open orders) → charts row
(design-status `DonutChart` + cost-by-division `BarChart`) → details row (`ProjectDetailsCard` +
right column: `ActivityFeed` + `TeamList`).

### Client layout (per `.pen` "Client Overview — Page")

`ReviewBanner` (if pending) → KPI row (awaiting-your-review · approved-by-you · files-shared ·
**project value only**) → charts row (your-review-progress `DonutChart` + per-phase design-progress
`BarChart`) → details row (client-safe `ProjectDetailsCard` + `ActivityFeed` + "your team" `TeamList`).

---

## 4. Cross-cutting

- **i18n** — all Overview labels under a new `projectOverview` namespace in `messages/en.json` +
  `messages/tr.json` (parity test enforces both). Reuse existing `projectDetail` keys where they
  already exist (client/PMs/architects/created/location/scope/area/estimate/status/category/due).
- **Role gating** — `OverviewTab` branches on `useUserRole()`; the endpoint **also** scopes
  server-side (defense in depth — a client request never receives costs even if the client is patched).
- **Reduced motion** — charts + staggers respect `prefers-reduced-motion` (reuse the app primitives).
- **Avatars** — `next/image` where a real avatar URL exists; initials fallback otherwise.

---

## 5. Tests

| Test                                                              | Covers                                                                                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/test/unit/getProjectOverview.test.ts`                        | role scoping (client bundle omits `openOrders`, costs, internal activity), cost-by-division roll-up, KPI counts.            |
| `src/test/api/project-overview.test.ts`                           | `GET /api/projects/[id]/overview` — 200 for PM/architect/client, 403 for no-access/vendor, client payload is cost-scrubbed. |
| `src/test/unit/DonutChart.test.tsx` + `BarChart.test.tsx`         | **DOM** (add to `HOOK_TEST_FILES` in `vitest.hooks-tests.ts`) — segments render, empty/zero state, reduced-motion.          |
| `src/test/unit/useActiveProjectTab.test.tsx` (or extend existing) | index route → `"overview"`; `/designs`,`/boq`,`/order` unchanged.                                                           |
| i18n parity                                                       | existing test picks up the new `projectOverview` keys automatically.                                                        |
| Remove/adjust                                                     | any test asserting `MetaBar` presence in the layout.                                                                        |

---

## 6. Task breakdown (execution order — single PR)

1. **Wiring** — `useActiveProjectTab` (+`overview`), `ProjectWorkflowSteps` (+Overview tab),
   `layout.tsx` (`showWorkflowSteps += base`, remove `MetaBar`, comments gate), `page.tsx` (render
   `OverviewTab` placeholder). App compiles, Overview tab highlights, tabs on top, no meta card.
2. **Data** — `types`, `getProjectOverview` (+ cost-by-division query), API route, `routes.ts` +
   wrapper + `useProjectOverview`. Verify payloads for a PM and a client against dev DB.
3. **Charts** — `DonutChart` + `BarChart` (+ DOM tests).
4. **Components** — `KpiCard`, `ProjectDetailsCard`, `ActivityFeed`, `TeamList`, `ReviewBanner`.
5. **Assemble** — `OverviewTab` PM + client layouts + skeleton; match the `.pen`.
6. **Delete** `MetaBar.tsx`; i18n keys; tests; `npm run check` + `npm run test:all`.
7. Close **#218**.

---

## 7. Risks / decisions

1. **`MetaBar` removal touches the client view** — the current client-variant inline bar
   (status/category/deadline/members) must reappear on the client Overview `ProjectDetailsCard`,
   or clients lose that info. Covered in §3 client layout.
2. **Cost-by-division** — `BoqSummary` is per-section; needs a division roll-up query (one extra join).
3. **`activity` source** — start with uploads + review decisions (both already indexed by project);
   fold in `audit_event` only if it's cheap. Cap at 6–8 rows, newest first. Never leak internal
   events to clients.
4. **Overview tab visual** — the `.pen` renders Overview as an accent pill with a dashboard icon
   (no status dot). Implement as a special first step in `ProjectWorkflowSteps` (icon instead of
   dot); reconcile against the frame during step 5, not a separate component.
5. **Vendor** — out of scope (no project access). Portfolio dashboard = follow-up.

---

## 8. Verification

- `npm run check` + `npm run test:all` green; **no migration**.
- Manual (dev DB, `studioblack-studio` org):
  - Open a project → lands on **Overview** with `Overview · Design · BOQ · Order` on top; Overview tab active.
  - Design/BOQ/Order render content **directly under the tab strip** — no meta card.
  - KPIs, donut, bar chart, details, activity, team all render for a PM.
  - Log in as the client → tabs are `Overview · Design · BOQ` (no Order); review banner + client KPIs;
    **no costs/margins**; charts render.
  - Header `Settings` (PM) + `Documents →` pills work from Overview.
