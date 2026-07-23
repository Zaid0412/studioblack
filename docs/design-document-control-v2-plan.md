# Design & Document Control Module — Full Plan (PDS v2.0)

Standalone implementation plan for the **entire** Design Management & Document Control Module as
specified in **PDS v2.0** (the 2026-07-22 revision of PRD tab "01.Design doc"). It reflects the
product decision to **lean into the PRD's metadata-driven model** — a single filterable drawing
library replaces the six hard-coded phase tabs.

> **Source:** [01.Design doc — PDS, updated revision (2026-07-22)](https://docs.google.com/document/d/1ByLjtVdTkPzwjgeRwJElWmMCNvvnKjxfxL50ciKRyjs/edit?tab=t.ovg5x0856f8g)
> (public — `…/export?format=txt&tab=t.ovg5x0856f8g`, follow the 307).
>
> **Relationship to [`design-document-control-plan.md`](./design-document-control-plan.md):** that
> doc is the earlier PR-1…PR-6 roadmap and its shipped-status ledger — **left as-is**. This doc is
> the comprehensive v2 target and re-phases the remaining work around the "metadata, not tabs"
> decision. Where the two disagree, this one is current.

---

## 1. The product shift (read this first)

PDS v2.0's central rule:

> "The system shall not organize drawings using fixed tabs such as: 2D, 3D, Plumbing, Floor Plans,
> Section View, Production Plan… every drawing shall be classified using structured metadata."

Today StudioBlack's Designs tab **is** those fixed tabs — the 6 `project_phase` rows
(`2D Layout, 3D Layout, Production Plan, Section View, Plumbing, Floor Plans`). PDS v2.0 replaces them
with a flat, filter-driven **drawing library**. Each drawing carries independent metadata
(Package · Discipline · Drawing Type · Representation · Location · Status), and the UI is
**filters over a single list**, never folders.

**Consequence:** finishing this module = retiring the phase tabs. Phases are woven through tasks,
approvals, comments, and the client view (281 refs across 61 files), so the cutover is the largest,
last, and riskiest step — see §9 (PR-D) and §11.

---

## 2. Current state (shipped, behind the dormant `designDocumentControl` flag)

PR-1 (#216), PR-2 (#217), PR-3 (#222), and **PR-3a (#233)** are merged, with all migrations applied
to dev + prod — including PR-3a's `migrate-drawing-representation-location.sql` (Representation/Location
columns + the PDS discipline/issue-purpose/drawing-type reconcile; its two columns are read by the
ungated attachment projection, so the migration was a deploy prerequisite). The flag is at **0%**.
What exists:

| Area              | Built                                                                                                                           | File(s)                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Packages          | `design_package` (per-project, 6 seeded, 10-state CHECK)                                                                        | `queries/designPackages.ts`, `migrate-design-packages.sql`                            |
| Disciplines       | `design_discipline` (per-org lookup, 10 seeded)                                                                                 | same                                                                                  |
| Drawing register  | `drawing` (1 per `version_group`, discipline/type/docnum, 12-state CHECK) + `attachment.drawing_id`                             | `queries/drawings.ts`, `migrate-drawings.sql`                                         |
| Numbering         | `nextDrawingNumber` on `sequence_counter`                                                                                       | `queries/sequences.ts`                                                                |
| Revisions         | `drawing_revision` (append-only, `issue_purpose`, `current_revision_id`)                                                        | `queries/drawingRevisions.ts`, `migrate-drawing-revisions.sql`                        |
| Markup 3-state    | `pin_comment.status` (open/resolved/closed)                                                                                     | same                                                                                  |
| Upload classify   | per-file Discipline + Drawing Type **+ Representation + Location** on upload (PR-3a)                                            | `UploadDesignDialog.tsx`, `queries/attachments.ts`                                    |
| Classification    | enums reconciled to PDS §4 (disciplines, 8 issue purposes, 13 drawing types) + `drawing.representation`/`location` cols (PR-3a) | `validations.ts`, `designTemplates.ts`, `migrate-drawing-representation-location.sql` |
| Reuse (unchanged) | viewer, markup, review→approve/reject, freeze (`frozen_at`), versioning                                                         | `DocumentViewer`, `submitAttachmentReview`, `uploadNewVersion`                        |

**Seeding:** disciplines seed per-org in `provisionNewOrg` (`orgProvisioning.ts`); packages seed
per-project in `createProject` (`queries/projects.ts`).

**Not yet built:** lifecycle _enforcement_, package rollup / mandatory
gate, audit+notify per transition, RBAC tiers, configurable master data, document categories beyond
drawings, cross-module relationships, the filter-based library UI, revision compare, and the phase
cutover.

---

## 3. Target data model

Hierarchy (PDS §2): `Project → Design Package → Discipline → Drawing Type → Location? → Drawing →
Version → Revision`. A **Drawing** is the header over an `attachment` `version_group`; `attachment`
rows stay the **Versions**; `drawing_revision` rows are the official **Revisions**.

### 3.1 `drawing` — add the missing metadata (additive, nullable-first)

```
representation   VARCHAR(10) NULL   -- 2D | 3D | REN | VR
location         VARCHAR(120) NULL  -- free text, optional lookup later
package_id       UUID NULL          -- exists; enforced at cutover
```

### 3.2 Master-data → per-org lookup tables (PDS §11 "configurable by company")

Today only `design_discipline` is data; Packages/Types/Purposes/Representation are code consts.
PDS requires all of them per-org configurable. Promote to lookups mirroring `design_discipline`:

```
design_package_template   (org_id, code, name, sort_order, is_active)   -- seeds a project's packages
drawing_type              (org_id, code, name, sort_order, is_active)
issue_purpose             (org_id, code, name, sort_order, is_active)
representation            (org_id, code, name, sort_order, is_active)
location                  (org_id, code, name, sort_order, is_active)   -- optional taxonomy
```

Until then the enum consts stay the single source; the promotion is one PR (PR-F) and is additive
(consts become seed data). `drawing.drawing_type/representation` stay VARCHAR columns validated
against the org's active rows.

### 3.3 Enum values (PDS §4 — the authoritative sets)

| Set                     | Values                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Design Packages** (6) | `CON` Concept · `SCH` Schematic · `DD` Design Development · `TD` Technical/Tender · `IFC` Issued for Construction · `ASB` As-Built                                       |
| **Disciplines** (10)    | `AR ID ST PLB ELC MEC HVAC LND FUR VIS`                                                                                                                                  |
| **Drawing Types** (13)  | `PLAN ELEV SECT DET PROD SHOP RCP ISO SCH SPEC REND MOD CAL`                                                                                                             |
| **Representation** (4)  | `2D` 2D Drawing · `3D` 3D Model · `REN` Rendering · `VR` Walkthrough/Animation                                                                                           |
| **Issue Purpose** (8)   | Internal Review · Client Review · For Approval · For Tender · For Construction · As-Built · Record Copy · Information Only                                               |
| **Drawing status** (12) | Draft → Submitted → Internal Review → Internal Approved → Sent to Client → Client Review → Changes Requested → Revised → Resubmitted → Client Approved → Frozen → Issued |
| **Package status** (10) | Draft → In Progress → Internal Review → Internal Approved → Sent to Client → Client Review → Changes Requested → Client Approved → Frozen → Completed                    |

⚠️ **Reconciles vs shipped** (all verified safe against dev+prod — nothing references the dropped
codes): disciplines `EL→ELC, PL→PLB, ME→MEC, LS→LND, FF→FUR, 3D→VIS`; issue purposes 5→8 (`for_review`
dropped); drawing types 10→13 (`LAY, 3DV` dropped).

### 3.4 Document numbering (PDS §3)

`<Project>-<Discipline>-<Type>-<Seq>` → `P2026-001-AR-PLAN-001`. Auto, immutable, never reused,
independent of Version/Revision. **Already implemented** (`nextDrawingNumber`). Representation and
Location are metadata only — never in the number.

### 3.5 Version vs Revision (PDS §5)

Version = every uploaded file (auto, never overwritten). Revision = an official issue (`Rev-00/01/…`),
created only on approved-and-issued. Multiple Versions may precede a Revision. Frozen ⇒ read-only; a
change makes a new Version; a reissue makes a new Revision. **Model already exists.**

---

## 4. Lifecycle & state machines

Model `DRAWING_TRANSITIONS` (12-state) and `PACKAGE_TRANSITIONS` (10-state) as
`Record<Action,{from[],to,pmOnly?,effects[]}>` in `validations.ts`, executed by a function cloned
from `transitionRateContract` (`SELECT … FOR UPDATE`, `from.includes(status)` guard, declarative
`effects`). Wire the existing review actions (`submitAttachmentReview`, freeze) to fire transitions.

- **Package rollup:** progress % = approved ÷ total mandatory drawings, computed on read.
- **Mandatory gate (PDS §7):** a package reaches `Completed` only when every mandatory drawing is
  `Client Approved` (or beyond). Guard = count of unapproved mandatory drawings must be 0.
- **`drawing.is_mandatory`** column drives the gate (default true; PM toggles).

---

## 5. RBAC (PDS §10) — configurable per company

Target matrix:

| Role             | Upload                       | Review | Approve | Freeze |
| ---------------- | ---------------------------- | ------ | ------- | ------ |
| Junior Architect | ✓                            | —      | —       | —      |
| Senior Architect | ✓                            | ✓      | ✓       | —      |
| Project Manager  | ✓                            | ✓      | ✓       | ✓      |
| Client           | View / Comment / Approve own | —      | —       | —      |
| Administrator    | full                         | full   | full    | full   |

Current roles are `pm / architect / client / vendor` — **no Junior/Senior tier**. Ship transitions on
`pmOnly`-style gates first (maps PM=Freeze, architect=Review/Approve); add a data-driven
Junior/Senior tier + per-company permission table later (PR-F). "Configurable by company" ⇒ a
`role_permission(org_id, role, capability)` table, deferred.

---

## 6. Document categories (PDS §9) — beyond drawings

Drawings, Renderings, Material Boards, Specifications, Calculation Sheets, Schedules, Meeting Minutes,
Site Photos, Permits, Client Correspondence, Reference Documents — **all follow the same
Version/Revision/Approval rules**. Add a `drawing.category` discriminator (default `drawing`) rather
than a parallel table, so one engine serves all. Non-drawing categories may skip
discipline/type/number (nullable already). The existing `project_document` system (admin docs,
private bucket, versioning only) folds in here or stays separate — decide in PR-E.

---

## 7. Cross-module relationships (PDS §12)

Optional UUID links from a drawing to: BOQ Items, Change Orders, Rooms/Spaces (future), RFIs (future),
Site Inspections (future). Implement as a thin `drawing_link(drawing_id, target_type, target_id)`
join, or nullable FK columns for the two live targets (BOQ, CO). Surfaces as "Related BOQ items / COs"
in the drawing drawer and deep-links both ways. Deferred to PR-E.

---

## 8. Client portal (PDS §8)

Clients: view drawings, view previous revisions, **compare revisions**, comment, markup, approve
package, approve/reject individual drawings, request changes. Most primitives exist (viewer, markup,
per-file review, send-to-client). New: **revision-compare UI** and **package-level approve**. Client
sees only sent drawings via the same flat library, filtered to their scope (no internal metadata).

---

## 9. Delivery — remaining PRs (metadata-first, cutover last)

> PR-1/2/3 shipped and **PR-3a merged (#233)** (§2); PR-A…PR-F carry the rest. Each ships value and
> de-risks the next; the NOT-NULL cutover (PR-D) runs last.

| PR                                             | Goal                                                                      | Key work                                                                                                                                                                      | Risk     |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **✅ PR-3a** Revision catch-up (#233)          | Match PDS enums + add the two new dimensions                              | discipline rename ×6; issue-purpose 5→8; drawing-type 10→13; `drawing.representation` + `drawing.location` cols; capture both on upload — **merged; migration pending apply** | Done     |
| **PR-A** Filter-based library UI               | The flat drawing list as the Designs tab (staff, flag-on) — no phase tabs | `getProjectDrawings`; `/api/projects/[id]/drawings`; filter bar (Discipline·Type·Representation·Location·Status); responsive table/cards; row→review                          | Med      |
| **PR-B** Lifecycle + rollup                    | Enforce 12/10-state transitions; mandatory gate; progress %               | `transitionDrawing`/`transitionPackage`; `drawing.is_mandatory`; wire review/freeze; `logAuditSafe` + notify per transition                                                   | Med-High |
| **PR-C** Client portal + revision compare      | Client flat view; approve package/individual; compare revisions           | client-scoped list; package approve; side-by-side revision viewer                                                                                                             | Med      |
| **PR-D** Cutover                               | Retire the 6 phase tabs everywhere; enforce classification                | backfill phases→metadata (§11); migrate design tasks to project-level; client flat view; flip `drawing_id`/`package_id`/`status` NOT NULL; stop seeding phases                | **High** |
| **PR-E** Categories + relationships            | Non-drawing document categories; BOQ/CO links                             | `drawing.category` discriminator; `drawing_link`; drawer "Related" panel                                                                                                      | Med      |
| **PR-F** Configurable master data + RBAC tiers | Per-org lookups; Junior/Senior tiers                                      | promote Types/Purposes/Packages/Representation/Location to lookup tables; `role_permission`; admin settings UI                                                                | Med      |

Order rationale: PR-3a + PR-A deliver the visible PRD win (metadata library) additively without
touching phases; PR-B/C add the workflow depth; **PR-D is the irreversible cutover** and runs only
once the library has replaced phases in daily use; PR-E/F are additive extensions.

---

## 10. Reuse map (do NOT rebuild)

`DocumentViewer` / `PinOverlay` / `ShapeDrawingLayer` (key on `attachment_id`) ·
`submitAttachmentReview` (immutable history + auto-freeze-on-approve + auto-task) · `frozen_at`
freeze + `uploadNewVersion` (frozen-group guard) · `sequence_counter` / `bumpSequenceCounter`
numbering · `transitionRateContract` executor pattern · `audit_event` / `logAudit` · SWR + typed
`src/lib/api` wrappers · animation primitives. This module is a **thin register + workflow layer over
the existing attachment engine**, not a rebuild.

---

## 11. Open product decisions (resolve before the PR they gate)

1. **Phase → metadata backfill (gates PR-D).** The 6 phases aren't milestones — they're
   representation/type facets. Proposed mapping: `2D Layout→Representation 2D`, `3D Layout→Representation 3D`,
   `Section View→Type SECT`, `Floor Plans→Type PLAN`, `Production Plan→Type PROD`, `Plumbing→Discipline PLB`;
   package defaults to `DD`, unset facets default (`AR`/`PLAN`/`2D`) and are flagged for staff
   reclassify. Needs a product sign-off — it decides how every legacy file lands.
2. **Design tasks' home (gates PR-D).** Tasks are phase-scoped today. With phases gone: move design
   tasks to project-level, or keep a slim non-UI phase for task grouping? Recommend project-level +
   optional drawing/package link.
3. **Client view at cutover (gates PR-C/D).** Clients move to the flat filtered library (sent
   drawings only), replacing their per-phase view. Confirm.
4. **`project_document` (System B) fate (gates PR-E).** Fold admin docs into the `category`
   discriminator, or leave separate. Recommend fold.
5. **RBAC depth (gates PR-F).** Ship `pmOnly`-style gates now; build the per-company
   `role_permission` table + Junior/Senior tiers only when a customer needs it.
6. **Audit immutability.** `audit_event` is append-only by convention only. If PDS's "complete
   audit" is a compliance requirement, add a revoke-UPDATE/DELETE trigger — a decision, not a default.

---

## 12. Migration & verification

Each PR: apply its migration on dev via the `studioblack-dev` MCP (then staging/prod), `npm run check`

- `npm run test:all`, and add API + unit tests alongside new routes/schemas (project convention).
  Additive-first (nullable cols, widened CHECKs, data-only seeds) for PR-3a…PR-C, PR-E/F; the NOT-NULL
  enforcement + phase retirement is isolated to **PR-D** so every earlier PR is reversible.
