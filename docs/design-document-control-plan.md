# Design → Document Control Module — Implementation Roadmap

Phased plan for evolving StudioBlack's design-review feature into the full AEC document-control
system specified in **PRD tab "01.Design doc"** (Design Management & Document Control Module).

> **Source PRD tab:** [01.Design doc — Design Management & Document Control (PDS)](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.sw56y13u47f3)

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

| PR                                         | Goal                                                                                                                   | Tables / key files                                                                                                                                                                                                | Reuses                                                              | Risk                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| **PR-1 Package backbone**                  | Design Packages + Disciplines exist & render (alongside phases, additive)                                              | `design_package`, `design_discipline` (+seeds); `queries/designPackages.ts`; `PACKAGE_TRANSITIONS` declared; seed hook in `projects.ts`                                                                           | project/phase seeding, `element_category` lookup                    | Low                                              |
| **PR-2 Drawing register + numbering**      | Files group into drawings w/ discipline, type, document_number                                                         | `drawing`, `attachment.drawing_id`; `nextDrawingNumber` + prefix widen; `queries/drawings.ts`; backfill drawings from `version_group`s                                                                            | attachment engine, `DocumentViewer`, markup, review — all unchanged | Medium                                           |
| **PR-3 Revisions & issue**                 | Official Rev-00/01/02 issues, issue-purpose, prev revisions read-only; markup Open/Resolved/Closed                     | `drawing_revision`, `drawing.current_revision_id`; `pin_comment.status` (backfill from `resolved`)                                                                                                                | `frozen_at` freeze, `attachment_review` append-only convention      | Medium                                           |
| **PR-4 Lifecycle + rollup + audit/notify** | Enforce 12-state drawing + 10-state package transitions; package approves only when all mandatory approved; progress % | `transitionDrawing`/`transitionPackage` (clone `transitionRateContract`); map `review_status`→`status`; `logAuditSafe` + notify per transition; new `notification.drawing_id`/`package_id` col + destination case | rate-contract executor, `audit_event`, notification fan-out         | Med-High                                         |
| **PR-5 Cutover**                           | Retire the 6 design phases; every design attachment lives under a package/drawing                                      | `scripts/migrate-design-cutover.sql` — backfill remaining attachments → default package, `drawing_id`/`package_id`/`status` NOT NULL, stop seeding design phases                                                  | BOQ `migrate-boq-drop-legacy.sql` precedent                         | High (NOT NULL flip + data migration; runs last) |
| **PR-6 (optional)**                        | Configurable RBAC tiers (Junior/Senior), non-drawing document categories, audit-timeline UI                            | permission tables; category discriminator; `audit_event`-backed UI (the `/audit` page currently reads `notification`)                                                                                             | —                                                                   | Scoped separately                                |

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
