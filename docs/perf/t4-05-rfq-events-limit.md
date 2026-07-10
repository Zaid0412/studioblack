# Cap `getRfqEvents` result set with a LIMIT

- **Tier / Impact / Effort:** T4 · Low · S
- **Area:** db
- **Files:** `src/lib/queries/rfqs.ts:351` (fn), `src/lib/queries/rfqs.ts:356-372` (query), `src/lib/queries/boq.ts:599-600` (precedent), `src/lib/queries/rateContracts.ts:326-327` (precedent)

## Problem

`getRfqEvents` (`src/lib/queries/rfqs.ts:351`) builds the RFQ activity timeline by pulling **every** matching `rfq.*` audit event (`target_table = 'rfq'`) plus **every** matching `vendor_quote` event (joined via `metadata->>'rfq_id'`), with `ORDER BY ae.created_at ASC` and **no LIMIT** (query at lines 356-372).

The result is bounded by a single RFQ's activity, not by table growth, so this is not a runaway query. But a heavily-revised RFQ — many `rfq.revised`, `rfq.communication_logged`, and repeated `quote.submitted` / `quote.revised` events across several vendors — returns an unbounded row set straight into the timeline, plus the downstream per-event vendor-name resolution loop. There's no ceiling.

Sibling history queries already cap themselves:

- `getBoqItemHistory` — `ORDER BY ae.created_at DESC, ae.id DESC LIMIT 100` (`boq.ts:599-600`)
- `getRateContractHistory` — `ORDER BY ae.created_at DESC, ae.id DESC LIMIT 100` (`rateContracts.ts:326-327`)

`getRfqEvents` is the odd one out.

## Fix

Add a cap consistent with the existing precedent. Note the established pattern in this codebase is `LIMIT 100` with `ORDER BY ... DESC` (not 200) — match it unless there's a reason RFQ timelines need more.

Two viable shapes:

1. **Latest-N, then reverse (matches precedent):** change to `ORDER BY ae.created_at DESC, ae.id DESC LIMIT 100`, then reverse the rows in JS before returning so the timeline still renders oldest-to-newest. This keeps the _most recent_ events when truncation happens — usually what a timeline wants — and mirrors `getBoqItemHistory` / `getRateContractHistory` exactly (including the `ae.id` tiebreaker for stable ordering).
2. **ASC with cap:** keep `ORDER BY ae.created_at ASC` and append `LIMIT 200`. Simpler, but truncates the _newest_ events on overflow, which is the wrong end for a timeline — avoid unless there's a specific reason.

Recommended: option 1 (DESC + LIMIT 100 + reverse), for consistency with the two existing history queries. Add an `ae.id` secondary sort key as the siblings do.

## Verification

- Timeline for a normal RFQ renders identically (oldest → newest) after the change.
- For an RFQ with >100 events, the query returns exactly 100 rows (the most recent) and the UI shows them in ascending order.
- Add/adjust a query test in `src/test/` covering `getRfqEvents`: assert the LIMIT is applied and ordering is correct (seed >100 audit events for one RFQ, assert count and first/last timestamps).
- `npm test` passes.

## Risks / notes

- If the timeline UI relies on showing the _entire_ history, capping silently hides older events. Confirm the timeline component either paginates or is acceptable showing the latest N. If full history is a hard requirement, add pagination instead of a bare cap — but that's a larger change than this T4.
- The `vendor_quote` branch joins via JSONB `metadata->>'rfq_id'`; the LIMIT applies to the combined set after the `OR`, so both branches are bounded together — correct.
