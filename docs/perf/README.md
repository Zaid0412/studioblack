# Performance Audit — Improvement Plans

Findings from a full read-only audit (client bundle, data-fetching, SQL, rendering,
assets, infra). Each item has its own plan file with problem → fix → verification →
risks. Line numbers are as of the audit; re-confirm before editing.

Baseline note: the app is already disciplined (visibility-gated polling, server
pagination, heavy libs lazy-loaded server-side, good indexes). These are targeted
wins, not a rescue.

## Tier 1 — ✅ Shipped (PR #183)

| Plan                                       | Fix                                                 | Impact / Effort |
| ------------------------------------------ | --------------------------------------------------- | --------------- |
| [t1-01](t1-01-pg-pool-shutdown-guard.md)   | Idempotent pg pool shutdown (fixes the build error) | High / S        |
| [t1-02](t1-02-cache-session-membership.md) | `cache()` session + membership reads                | High / S        |
| [t1-03](t1-03-lazy-load-react-markdown.md) | Lazy-load react-markdown out of the global layout   | High / S        |
| [t1-04](t1-04-defer-pdfjs.md)              | Defer `pdfjs-dist` to runtime                       | High / S        |
| [t1-05](t1-05-boq-row-memo.md)             | Fix BOQ row `memo` (unstable callback props)        | High / S        |
| [t1-06](t1-06-pg-pool-max-pooler.md)       | Lower pool `max`, confirm prod uses the pooler      | Med-High / S    |
| [t1-07](t1-07-middleware-api-matcher.md)   | Exclude `/api` from the middleware matcher          | Med / S         |

## Tier 2 — ✅ Shipped (perf/tier-2)

| Plan                                        | Fix                                              | Impact / Effort |
| ------------------------------------------- | ------------------------------------------------ | --------------- |
| [t2-01](t2-01-n1-getBestRateForElements.md) | `getBestRateForElements` N+1 → set-based         | High / M        |
| [t2-02](t2-02-n1-addElementsToBoq.md)       | `addElementsToBoq` N+1 + non-atomic → bulk tx    | High / M        |
| [t2-03](t2-03-self-host-fonts.md)           | Self-host fonts via `next/font/local`            | High / M        |
| [t2-04](t2-04-defer-posthog.md)             | Defer/idle-init PostHog + sample replay          | Med-High / M    |
| [t2-05](t2-05-attachment-phase-count.md)    | Stop over-fetching attachments for a phase count | Med / M         |

## Tier 3 — solid targeted wins

| Plan                                       | Fix                                                    | Impact / Effort |
| ------------------------------------------ | ------------------------------------------------------ | --------------- |
| [t3-01](t3-01-dashboard-phase-index.md)    | Partial index for dashboard `phase` scans              | Med / S         |
| [t3-02](t3-02-quotecomparison-subquery.md) | `getQuoteComparison` per-vendor subquery + drop `vq.*` | Med / M         |
| [t3-03](t3-03-on-rfq-join.md)              | `on_rfq` per-row EXISTS → single join                  | Med / S         |
| [t3-04](t3-04-list-aggregates-lateral.md)  | Vendor/rate-contract list aggregates → `LATERAL`       | Med / S         |
| [t3-05](t3-05-sidebar-avatar-nextimage.md) | Sidebar logo + avatars raw `<img>` → `next/image`      | Med / S         |
| [t3-06](t3-06-login-hero-priority.md)      | `priority` on the login hero logo                      | Med / S         |
| [t3-07](t3-07-splashscreen-dual-logo.md)   | SplashScreen fetches both logo variants                | Low-Med / S     |
| [t3-08](t3-08-boq-import-preview.md)       | BOQ import preview renders ≤5000 rows unvirtualized    | Med / M         |

## Tier 4 — cleanup / low

| Plan                                       | Fix                                                       | Impact / Effort |
| ------------------------------------------ | --------------------------------------------------------- | --------------- |
| [t4-01](t4-01-remove-tanstack-table.md)    | Remove unused `@tanstack/react-table` (or virtualize BOQ) | Low / S         |
| [t4-02](t4-02-optimize-package-imports.md) | `optimizePackageImports` for dnd-kit / react-table        | Low / S         |
| [t4-03](t4-03-memoize-context-values.md)   | Memoize Theme/Sidebar context values                      | Low / S         |
| [t4-04](t4-04-compress-favicon.md)         | Compress the 45 KB `icon.png` favicon                     | Low / S         |
| [t4-05](t4-05-rfq-events-limit.md)         | `LIMIT` on `getRfqEvents`                                 | Low / S         |
| [t4-06](t4-06-spreadsheet-worker.md)       | SpreadsheetViewer parse → web worker                      | Low / M         |

## Plan file template

```
# <Title>

- **Tier / Impact / Effort:** T? · High/Med/Low · S/M/L
- **Area:** bundle | data-fetching | db | rendering | assets | infra
- **Files:** `path:line`

## Problem
## Fix
## Verification
## Risks / notes
```
