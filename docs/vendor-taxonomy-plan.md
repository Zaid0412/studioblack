# Vendor Taxonomy Implementation Plan

> Spec source (Google Docs — PRD): **RFQ & Vendor Management FRD** and **Vendor Master Taxonomy**
> tabs (linked in `docs/boq-implementation-plan.md`). This plan resolves the two open
> decisions that doc parked under "Revisions from PRD Tabs 7–10".

## Background

The shipped code categorises vendors by **reusing the `element_category` tree** via
`vendor_trade.category_id`, and stores service areas as a free-text `vendor.service_areas TEXT[]`.
The Vendor Master Taxonomy tab instead specifies a **separate** vendor classification
(its own categories/sub-categories + structured service areas). These are mutually exclusive.

## Decisions (locked)

| Decision                      | Choice                                                              |
| ----------------------------- | ------------------------------------------------------------------- |
| Vendor categories vs Elements | **Separate** vendor taxonomy (own tables), per the Taxonomy tab     |
| Category depth                | **3 levels** (category → sub → sub-sub)                             |
| Service area                  | **Structured** + **hierarchical**: State (L1) → City (L2, optional) |
| RFQ ↔ vendor matching         | **(a)** a vendor-category ↔ element-category **mapping** table      |
| Management UI                 | **Inline on `/vendors`** (not Settings)                             |
| Permission / gate             | `vendorManagement` flag + PM/architect role                         |
| Proficiency levels            | **Keep** `standard` / `specialist` / `preferred`                    |

## Target schema

```sql
-- vendor category tree (own taxonomy, codes like JOIN/FLR/FIN)
vendor_category(id, org_id, name, parent_id→vendor_category, level CHECK 1..3,
                code VARCHAR(10), sort_order, icon, color, is_active, …)

-- structured service areas (State → City, city optional)
vendor_service_area(id, org_id, name, parent_id→vendor_service_area NULL,
                    level CHECK 1..2, sort_order, is_active, …)

-- vendor ↔ vendor-category (replaces vendor_trade)
vendor_category_map(vendor_id, vendor_category_id, proficiency_level, notes,
                    UNIQUE(vendor_id, vendor_category_id))

-- vendor ↔ service area
vendor_service_area_map(vendor_id, service_area_id, PRIMARY KEY(both))

-- THE BRIDGE — makes RFQ matching work without sharing the tree
vendor_category_element_map(vendor_category_id, element_category_id, PRIMARY KEY(both))
```

## RFQ matching rework

Today: `vendor_trade.category_id == BOQ item's element category`.
New: `BOQ item → element_category_id → vendor_category_element_map → vendor_category_id →
vendor_category_map → suggested vendors`. One query rewrite in `queries/rfqs.ts` + tests.

## Phasing (each PR ships independently)

- **PR 1 — Vendor category taxonomy foundation (this PR).** `vendor_category` tree table
  - queries + `/api/vendor-categories` CRUD + **management UI on `/vendors`** (create /
    add-subcategory / edit / delete, up to 3 levels). Ships with an **empty tree** — PMs build
    it. Purely additive: does **not** touch `vendor_trade`, the vendor form, or RFQ matching yet.
- **PR 2 — Wire vendors to the new tree.** `vendor_category_map`, switch the vendor form's
  Trades picker + the `/vendors` filter sidebar from element → vendor categories, migrate
  existing `vendor_trade` data, deprecate `vendor_trade`.
- **PR 3 — Structured service areas.** `vendor_service_area` (+ hierarchy) + `vendor_service_area_map`
  - management UI, migrate the `service_areas TEXT[]`.
- **PR 4 — RFQ matching bridge.** `vendor_category_element_map` + rewrite vendor-suggestion query.

## Notes

- Category seed (the Taxonomy tab's real categories/codes) is **not** loaded in PR 1 — the tree
  ships empty and the official seed drops in later via a starter-set, once the tab is available.
- UI mirrors the proven element-category management (`element_category` queries / API / settings
  page). If a third category-tree consumer appears, factor the shared bits into a generic
  `TreeManager`; until then, vendor-specific components avoid destabilising the elements feature.
