# Shared Unified Taxonomy Plan

> **Supersedes** the reverted separate-vendor-taxonomy work (PR #144 → reverted in #145).
> Source of truth: the "Arch PRD" Google Doc, vendor-taxonomy tab (`t.byxoydqtjbd3`).

## The decision

Use **ONE shared master taxonomy** across the whole platform — **do not** maintain a
separate vendor classification. The doc is explicit: separate element/vendor category
masters "will drift apart and become a maintenance nightmare."

```
Category  (L1)   e.g. Kitchen            KIT
   ↓
Sub-category (L2) e.g. Cabinets          KIT-CAB
   ↓
Service Area (L3) e.g. Base Cabinets     KIT-CAB-BASE
```

- **Vendors store only Service Areas** (the leaf, L3). Category / Sub-category are _derived_.
- Elements, BOQ items, RFQs, POs, Invoices all reference the **same** hierarchy.
- Module-specific fields stay on their own tables (element costs, vendor contact/rating,
  BOQ qty/price). Only the _classification_ is shared.

## Core realization — adoption, not new build

`element_category` is **already** the shared 3-level tree (used by elements, `vendor_trade`,
rate contracts). So L1=Category, L2=Sub-category, **L3=Service Area**. No new tables, and
RFQ matching (`getSuggestedVendorsForRfq`) already walks category ancestors → **leaf-level
vendor mapping works with no query change**.

## Locked decisions

| #   | Decision                                        | Choice                                                                       |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Seed category/sub/service names                 | **Literal** (English domain terms) + **codes** — not i18n keys               |
| 2   | Code storage                                    | Store the **full path code** (`KIT-CAB-BASE`) in `code_prefix`               |
| 3   | `vendor.service_areas TEXT[]` (free-text, #142) | **Retire** — replaced by leaf service-area nodes                             |
| 4   | Sequencing                                      | **PR 1 = seed first**, then framing/vendor mapping, then /vendors management |

## Phasing

### PR 1 — Official taxonomy seed + 3-level/code support (this PR)

- **Migration:** widen `element_category.code_prefix` `VARCHAR(10)` → `VARCHAR(20)` (codes like
  `KIT-CAB-BASE` are 12 chars).
- **Seed mechanism:** the current starter-set (`categoryTemplates.ts` + `bulkCreateCategoriesFromTemplates`)
  is 2-level / i18n-keyed / no codes. Extend it to **3 levels + per-node codes + literal names**,
  and make the **official 14-category taxonomy** the canonical starter set
  (14 categories, ~60 sub-categories, ~150 service areas, all coded — extracted from the doc).
- **UI:** the "Use a starter set" dialog renders literal names + codes.
- Tests + remove the now-unused `elements.starterCategories.*` i18n keys.

### PR 2 — Vendors map to leaf service areas; retire free-text `service_areas` (DONE)

- Vendor "Trades" relabeled to **"Service areas"**; the picker is constrained to
  **sub-category + leaf (L2/L3)** nodes via a `minDepth` prop on `CategorySelect`
  (top-level categories excluded). Vendors map via existing `vendor_trade`.
- **Retired `vendor.service_areas TEXT[]`** entirely — dropped the column
  (`scripts/migrate-vendor-drop-service-areas.sql`), the free-text form field, the
  `/api/vendors/service-areas` route, the distinct-values query/hook, and the list
  filter dropdown. Filtering now goes through the category-tree sidebar
  (`vendor_trade` + descendants). RFQ matching unchanged.
- Data: prod had 0 values, dev had 1 test value — clean drop, no backfill.
- Internal names kept (`vendor_trade` table, `trades`/`VendorTrade` types) — UI text only.

### PR 3 — Category management on /vendors (the original feedback)

- Surface the existing element-category management on `/vendors` (a "Manage categories" entry,
  "shared with Elements" note), operating on the shared tree. No duplicate taxonomy.

## Reused as-is (no rebuild)

`element_category` schema + CRUD + drag-reorder + starter-set flow, `vendor_trade`,
`getSuggestedVendorsForRfq` (ancestor-walk matching), the settings category manager.

## Notes

- The reverted `docs/vendor-taxonomy-plan.md` (separate model) is obsolete; this file replaces it.
- The full seed table (14 categories incl. KIT/JOIN/FLR/ELC/PLB/HVAC/FFE/CLG/FIN/DWG/LGT/FIRE/CIV/MET)
  is transcribed from the PRD tab; sub-category display names are expanded from the codes and are
  editable in-app after seeding.
