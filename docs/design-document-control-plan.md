# Design → Document Control Module — Implementation Roadmap

Phased plan for evolving StudioBlack's design-review feature into the full AEC document-control
system specified in **PRD tab "01.Design doc"** (Design Management & Document Control Module).

> **Source PRD tab:** [01.Design doc — Design Management & Document Control (PDS) — updated revision (2026-07-22)](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.ovg5x0856f8g) · supersedes the [original tab](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.sw56y13u47f3) this plan was first written from. See **[PRD update](#prd-update-2026-07-22-revision)** below for the deltas.

## Context

The PRD specifies the hierarchy **Project → Design Package → Discipline → Drawing → Version →
Revision**, with structured document numbering, package/drawing lifecycles, revisions distinct from
versions, an audit trail, and package progress metrics.

**Key product decision:** the PRD's **Design Packages replace the current 6 design phases** (2D
Layout, 3D Layout, Production Plan, Section View, Plumbing, Floor Plans) as the primary grouping for
design drawings.

**Central insight:** most of the _expensive_ PRD capability already exists in the codebase — the
in-browser viewer + markup (pins/shapes/freehand, threads, resolve), version control
(`version_group`), review → approve/reject history, design freeze, send-to-client, and review
notifications. Reusable infrastructure also exists: `audit_event` + `logAudit`, `sequence_counter`
numbering, the declarative rate-contract state-machine pattern, and per-project roles. So this is a
**thin register layer on top of the existing `attachment` engine**, not a rebuild.

## PRD update (2026-07-22 revision)

The source PRD tab was revised (new tab `t.ovg5x0856f8g`). Deltas vs the version this plan was
written from, and how they map to the roadmap:

**New classification dimensions on a drawing** — both optional and filter-only, so they're additive
nullable columns and don't change the `drawing`-over-`version_group` model:

- **Representation** — `2D / 3D / REN / VR` ("how the design is presented — _not_ a drawing type").
  Replaces hard-coded 2D/3D tabs with metadata. → new `drawing.representation` column.
- **Location** — optional spatial reference; free-text with an optional lookup (Ground Floor, Kitchen,
  Villa Block, …), used for filtering only, never in the document number. → `drawing.location`
  (nullable text) now, per-org lookup later if needed.

  Land both as one small additive migration + the cascading-filter UI. Numbering stays
  `<Project>-<Discipline>-<Type>-<Seq>`.

**Enum changes — two diverge from already-shipped code:**

- ⚠️ **Discipline codes changed.** PRD is now `AR, ID, ST, PLB, ELC, MEC, HVAC, LND, FUR, VIS`;
  **PR-1 seeded** `AR, ID, ST, EL, PL, ME, HVAC, LS, FF, 3D`. Reconcile the seed (disciplines are
  per-org data → a seed/data update, not schema).
- ⚠️ **Issue Purpose expanded to 8:** Internal Review, Client Review, For Approval, For Tender, For
  Construction, As-Built, Record Copy, Information Only. **PR-3 shipped 5** (`for_review,
  for_approval, for_information, for_construction, as_built`). Extend `ISSUE_PURPOSES` + widen the
  `drawing_revision.issue_purpose` CHECK (additive).
- **Drawing Type** now enumerated explicitly (~13): `PLAN, ELEV, SECT, DET, PROD, SHOP, RCP, ISO, SCH,
  SPEC, REND, MOD, CAL`. Align the `drawing_type` const to this set.

> All of the above — the two new dimensions plus these enum/seed reconciliations — are additive and
> scoped to **PR-3a** in the roadmap below.

**Newly specified, lands in later PRs:**

- **Configurable master data** — Drawing Types, Issue Purposes, and **Packages** should be
  customizable per company (today they're code consts; only Disciplines are data). → widen to per-org
  lookup tables with the Disciplines work in **PR-6**.
- **Document relationships** — optional UUID links from a drawing to BOQ items / change orders (and
  future RFI / inspection / space tracking). → **PR-6** / separate.
- **Granular configurable RBAC** — explicit matrix (Junior/Senior Architect, PM, Client, Admin ×
  upload / review / approve / freeze), "configurable by company". Confirms the **PR-6** RBAC scope.

**Confirmed unchanged (our build already matches):** Design Package codes (CON/SCH/DD/TD/IFC/ASB), the
12-state drawing lifecycle, the 10-state package lifecycle, the document-number format, the
mandatory-drawing package-completion gate, and the audit-trail requirement.

## Architecture (data model)

A "drawing" is a **header row over an existing `version_group`**; `attachment` rows stay the
versions. This avoids forking the versioning/review/markup/freeze logic already wired into
`DocumentViewer.tsx`, `submitAttachmentReview`, and `uploadNewVersion`.

New tables (additive, nullable-first → backfill → enforce, mirroring the BOQ arc):

- **`design_package`** — replaces `project_phase` for design grouping. `code` (CON/SCH/DD/TD/IFC/ASB),
  `name`, `sort_order`, `status` (10-state lifecycle), `project_id`, `org_id`. Seeded 6-per-project
  on create (replaces the `PROJECT_PHASES` seed in `src/lib/queries/projects.ts`).
- **`design_discipline`** — per-org lookup (mirrors `element_category`), so custom disciplines are
  data not code. Seeded with the 10 defaults (AR/ID/ST/EL/PL/ME/HVAC/LS/FF/3D).
- **`drawing`** — the register header, one row per `version_group`: `package_id`, `discipline_id`,
  `drawing_type` (PLAN/ELEV/SECT/… fixed const), `document_number` (`P-2026-001-AR-PLAN-001`, unique
  per project), `title`, `is_mandatory`, `status` (12-state lifecycle), `current_revision_id`,
  `version_group`.
- **`attachment.drawing_id UUID NULL`** FK → `drawing`. `version_group` stays; `drawing` carries the
  same value so `getAttachmentVersionHistory` / `uploadNewVersion` keep working unchanged.
- **`drawing_revision`** — the one genuinely new concept: official issues Rev-00/01/02. `drawing_id`,
  `rev_number INT`, `attachment_id` (the exact version snapshotted), `issue_purpose`, `issued_by`,
  `issued_at`. Append-only → read-only for free.

**Reuse verbatim (do NOT rebuild):** `DocumentViewer` / `PinOverlay` / `ShapeDrawingLayer` (key on
`attachment_id`), `submitAttachmentReview` (immutable history + auto-freeze-on-approve + auto-task),
`_shared/freezeHandler.ts` + `frozen_at`, `uploadNewVersion` (frozen-group guard).

**Numbering:** add `nextDrawingNumber(executor, orgId, projectNumber, discipline, type)` beside
`nextDocumentNumber` in `src/lib/queries/sequences.ts`, reusing `sequence_counter` /
`bumpSequenceCounter`. Counter key `${projectNumber}-${discipline}-${type}`, `year=0`. Two fixes:
widen `sequence_counter.prefix` (VARCHAR(20)→40, precedent `scripts/migrate-category-code-width.sql`);
the leading `P-` display dash is presentation-only — do **not** change `nextProjectNumber`'s stored
`P2026-001` form.

**State machines:** model `DRAWING_TRANSITIONS` (12-state) and `PACKAGE_TRANSITIONS` (10-state) as
`Record<Action, {from[], to, pmOnly?, effects[]}>` maps in `src/lib/validations.ts`, executed by a
function cloned from `transitionRateContract` (`SELECT … FOR UPDATE`, `from.includes(status)` guard,
declarative `effects`). Package approve adds a `requiresAllMandatoryApproved` guard (count of
mandatory drawings not yet approved must be 0). Progress % = approved/total, computed on read. Start
transitions on `pmOnly`-style gates; defer data-driven RBAC tiers.

## PR roadmap (4–6 independently-shippable PRs)

> **Status (2026-07-22):** PR-1 (#216), PR-2 (#217), and PR-3 (#222) shipped and merged — live behind the `designDocumentControl` PostHog flag (0% / dormant). Migrations applied to dev/staging and prod. PR-3a (PRD 2026-07-22 revision catch-up) and PR-4–PR-6 not started.

| PR                                              | Goal                                                                                                                   | Tables / key files                                                                                                                                                                                                | Reuses                                                              | Risk                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| **✅ PR-1 Package backbone** (#216)             | Design Packages + Disciplines exist & render (alongside phases, additive)                                              | `design_package`, `design_discipline` (+seeds); `queries/designPackages.ts`; `PACKAGE_TRANSITIONS` declared; seed hook in `projects.ts`                                                                           | project/phase seeding, `element_category` lookup                    | Low                                              |
| **✅ PR-2 Drawing register + numbering** (#217) | Files group into drawings w/ discipline, type, document_number                                                         | `drawing`, `attachment.drawing_id`; `nextDrawingNumber` + prefix widen; `queries/drawings.ts`; backfill drawings from `version_group`s                                                                            | attachment engine, `DocumentViewer`, markup, review — all unchanged | Medium                                           |
| **✅ PR-3 Revisions & issue** (#222)            | Official Rev-01/02/03 issues, issue-purpose, prev revisions read-only; markup Open/Resolved/Closed                     | `drawing_revision`, `drawing.current_revision_id`; `pin_comment.status` (backfill from `resolved`)                                                                                                                | `frozen_at` freeze, `attachment_review` append-only convention      | Medium                                           |
| **⏳ PR-3a Apply PRD 2026-07-22 revision** (additive) | Reconcile shipped classification with the revised PRD: discipline seed → `PLB/ELC/MEC/LND/FUR/VIS`; Issue Purpose 5→8 (add Internal/Client Review, For Tender, Record Copy, Information Only); align `drawing_type` to the ~13-type enum; add optional **Representation** (`2D/3D/REN/VR`) + **Location** (free-text/lookup) drawing dimensions + cascading filters | `design_discipline` seed; `ISSUE_PURPOSES` + widen `drawing_revision.issue_purpose` CHECK; `drawing_type` const; new nullable `drawing.representation` + `drawing.location` cols; classification filter UI | PR-1 seed hook, `validations.ts` enums, upload/DrawingMeta dialog, existing list-filter patterns | Low (additive: nullable cols, enum/CHECK widen, data-only seed) |
| **⏳ PR-4 Lifecycle + rollup + audit/notify**   | Enforce 12-state drawing + 10-state package transitions; package approves only when all mandatory approved; progress % | `transitionDrawing`/`transitionPackage` (clone `transitionRateContract`); map `review_status`→`status`; `logAuditSafe` + notify per transition; new `notification.drawing_id`/`package_id` col + destination case | rate-contract executor, `audit_event`, notification fan-out         | Med-High                                         |
| **⏳ PR-5 Cutover**                             | Retire the 6 design phases; every design attachment lives under a package/drawing                                      | `scripts/migrate-design-cutover.sql` — backfill remaining attachments → default package, `drawing_id`/`package_id`/`status` NOT NULL, stop seeding design phases                                                  | BOQ `migrate-boq-drop-legacy.sql` precedent                         | High (NOT NULL flip + data migration; runs last) |
| **⏳ PR-6 (optional)**                          | Configurable RBAC tiers (Junior/Senior), non-drawing document categories, audit-timeline UI                            | permission tables; category discriminator; `audit_event`-backed UI (the `/audit` page currently reads `notification`)                                                                                             | —                                                                   | Scoped separately                                |

Sequencing mirrors the BOQ arc: additive schema + backfill first, enforcement (NOT NULL, legacy
retire) last, so each PR ships value and de-risks the next.

## Open decisions (resolve as we reach each PR)

1. **Phase→package backfill target** (blocks PR-5): the existing 6 phases don't map 1:1 to the 6 PRD
   package codes. Proposed: land legacy attachments in `DD` (Design Development) with a `MISC`
   discipline. Needs a product call before the cutover.
2. **RBAC tier scope:** ship transitions on `pmOnly` now + defer data-driven Junior/Senior tiers to
   PR-6 (recommended), vs build a permission table up front (heavier PR-1). Current roles:
   pm/architect/client/vendor (`src/lib/effectiveRole.ts`), no Junior/Senior tier.
3. **System B merge:** `project_document` / `project_document_section` (admin docs, private bucket,
   versioning only — no review/markup/freeze) overlaps the PRD's "document categories beyond
   drawings." Recommend leaving it out of the core arc; revisit in PR-6.
4. **Markup 3-state:** existing `pin_comment.resolved BOOLEAN` vs PRD Open/Resolved/Closed. Additive
   `pin_comment.status` backfilled from `resolved`; decide later whether to drop `resolved`.
5. **Audit immutability:** `audit_event` is append-only _by convention_ only (`logAudit` is
   INSERT-only, no DB trigger/grant). If the PRD's "immutable audit log" is a compliance requirement,
   add a revoke-UPDATE/DELETE or trigger — a decision, not a default.

## Per-PR verification

Each PR carries its own end-to-end check when built:

- Apply its migration on the dev DB (via the `studioblack-dev` MCP), then `npm run check` +
  `npm run test:all`.
- Exercise the affected flow in the review workspace (`/projects/[id]/review/[designId]`) and the
  designs tab manually.
- Add API + unit tests alongside new routes/schemas (project convention).
