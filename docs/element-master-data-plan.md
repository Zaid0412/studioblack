# Element master-data: every BOQ line links a real Element (auto-create + dedup)

Source: PRD sub-doc **"2.2 Element ID updates"** (Master Data Design Specification),
linked under Vendor-cat/sub/service in `boq-implementation-plan.md`.

## Goal

A manually-created BOQ line must resolve to a real **Element** in the library —
either an existing one the user reuses, or one the system **auto-creates**. No
"Save to Library?" toggle. Before auto-creating, search for likely duplicates
(Service Area + Description + Keywords) and suggest them inline.

This supersedes #209 (which put a generated `item_code` on custom lines but left
`element_id` null). Now every line carries `element_id`.

## Confirmed decisions

1. **R1 = full enforcement.** Backfill every existing orphan line into the library
   as a Custom element, link it, then `boq_item.element_id` → `NOT NULL`.
   (Dev studioblack-studio: 13 orphan lines; prod: check before backfill.)
2. **Dedup UX = inline suggestions** (non-blocking; matches R3 "no confirmation").
3. **Status model = full taxonomy** — `standard` / `custom` / `company_standard`
   (+ Archived via `is_active`; Draft flagged below), with a promote flow.

## Data model (Stage 1 migration)

`element` gains:

- `element_type` — `VARCHAR(20) NOT NULL DEFAULT 'standard'` validated in app code
  (`ELEMENT_TYPES`), matching the codebase's status-column convention (no DB
  enums / CHECKs). Values `standard | custom | company_standard`; existing rows →
  `standard`; BOQ-auto-created → `custom`; promoted → `company_standard`. R4's
  Status/Source axis.
- `origin_boq_id UUID REFERENCES boq(id) ON DELETE SET NULL` — the originating
  BOQ (R4). Null for library-created. `created_by` + `created_at` already cover
  Creator + Date.
- **pg_trgm**: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + a GIN trigram index on
  `lower(description)` for the dedup search.

`boq_item.element_id`: backfilled (Stage 5), then `SET NOT NULL`, and the FK
flips `ON DELETE SET NULL` → `RESTRICT` (a line's element can't be hard-deleted;
elements are soft-deleted via `is_active`, matching the immutability principle).

> **Open sub-decision — "Draft".** The spec lists a Draft/"under review" state, but
> no review workflow is defined anywhere. Proposed: defer Draft (use
> `element_type` + `is_active` for v1); add it only if a review flow is specced.

## Stages

### Stage 2 — Duplicate search

- `findSimilarElements(orgId, { categoryId, description, tags })` in
  `queries/elements.ts`: same org + `is_active`, **same Service Area**
  (`category_id`), ranked by `similarity(lower(description), $q)` plus tag overlap
  (`tags && $tags`), threshold ~0.3, `LIMIT 5`.
- `GET /api/elements/similar?categoryId=&q=&tags=` (validated), client wrapper
  `elements.findSimilar(...)`.

### Stage 3 — Server create path (auto-create the element)

- The manual-create path (`createBoqItem` via `addBoqItem` / `insertBoqItemBetween`)
  when there's no `elementId`: **create a `custom` Element** in the same
  transaction (name ← provided name else description; `element_type='custom'`,
  `origin_boq_id`, `created_by`; code from the existing `generateElementCodeFor`),
  then insert the line with that `element_id`. `item_code` stays = the element's code.
- Batch/library/rate paths already link an element — unchanged.

### Stage 4 — Create-flow UI (`BoqCreateItemSheet`)

- **Remove** the "Save to element library" toggle + `saveAsElement` state.
- **Inline "Similar elements" panel**: once a Service Area is picked and the
  description is long enough, debounced call to `/similar`; render matches with a
  **"Use this"** action → sets `elementId`, prefills cost/unit fields (client-side
  `elementRowToBoqItemInput`), shows a "linked to <code>" chip with an un-link.
- Save: linked → reuse (Scenario 1); otherwise omit `elementId` → server
  auto-creates (Scenario 2). Name defaults to description when blank.

### Stage 5 — Backfill + enforce (SEPARATE PR — riskiest)

- **Node script** (`scripts/backfill-boq-element-ids.mjs`) — code generation is JS
  (`generateElementCodeFor`, advisory-locked), so this can't be pure SQL. Per org,
  for each orphan line, **dedup by `(category_id, lower(description))`** → create
  ONE `custom` element per group (avoid an element explosion), link every line in
  the group, set `origin_boq_id`.
- Then a SQL migration: `element_id SET NOT NULL` + FK → `RESTRICT`.
- Run dev → verify → prod (with a fresh orphan-count check first).

### Stage 6 — Taxonomy UI + promote

- Element Library list: **type badges** (Standard / Custom / Company Standard),
  filter by type, keep the Archived (`is_active`) filter.
- **Promote**: action on a Custom element → `PATCH /api/elements/[id]` sets
  `element_type='company_standard'` (preserves code + history — no re-code).

### Stage 7 — Tests

- `findSimilarElements` (same-SA gate, ranking, threshold).
- Auto-create path: manual line with no element → a `custom` element is created +
  linked, code generated, `origin_boq_id` set; reuse path links without creating.
- Backfill script dry-run (dedup grouping); NOT-NULL migration.
- Promote route; type filter. Route/schema validation for `/similar`.

## Suggested PR split

- **PR-A** — Stages 1–4 + 7 (schema, dedup search, auto-create, UI). `element_id`
  still nullable; new lines always link. Ships the whole _behavior_.
- **PR-B** — Stage 5 (backfill + `NOT NULL` + FK). Isolated, reversible-in-review,
  run against dev/prod deliberately.
- **PR-C** — Stage 6 (taxonomy badges + promote flow).

## Risks / notes

- **`element_id` blast radius**: ~60 references across boq / elements / rfqs /
  rateContracts. Making it `NOT NULL` is safe only _after_ a complete backfill;
  the FK change to `RESTRICT` must land with it or a hard element delete breaks it.
- **Supersedes #209's model**: `item_code`-only custom lines become real elements.
  Keep `item_code` mirroring `element.code` so nothing reading it breaks.
- **Backfill volume**: creates real elements (consumes per-prefix code sequences).
  Dedup keeps it proportional to distinct (SA, description) pairs, not line count.
- **Immutability**: no re-code on edit / promote; a Service-Area change still spawns
  a new element — already our behaviour, just now with a real element row.
