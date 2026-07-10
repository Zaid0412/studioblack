# Stop over-fetching all attachments just to derive per-phase counts

- **Tier / Impact / Effort:** T2 · Med · M
- **Area:** data-fetching
- **Files:** `src/hooks/useProjectDetail.ts:41-45` (`useSWR('/api/projects/${id}/attachments?all=true')`), `src/hooks/useProjectDetail.ts:191-197` (`phaseCounts` derivation), `src/app/(dashboard)/projects/[id]/layout.tsx:50-58,219,235` (layout calls `useProjectDetail` only for `phaseCounts` → `MetaBar` / `ProjectWorkflowSteps`), `src/lib/queries/attachments.ts:4-46` (`getAttachments`, the `all=true` full-row query), `src/app/api/projects/[id]/attachments/route.ts:16-32` (GET route)

## Problem

`useProjectDetail` unconditionally fetches `/api/projects/${id}/attachments?all=true`
(`useProjectDetail.ts:45`). With `all=true`, `getAttachments` (`attachments.ts:34-44`) runs a
`DISTINCT ON (version_group)` CTE and returns the **latest full row of every file in the
project** (`a.*` + `uploaded_by_name`).

The shared project layout (`projects/[id]/layout.tsx`) calls `useProjectDetail` on **every**
project sub-route (Overview, BOQ, Order, Documents, …) but only consumes `phaseCounts` from
it (`layout.tsx:55`, passed to `MetaBar` `line 219` and `ProjectWorkflowSteps` `line 235`).
`phaseCounts` is just a `Map<phaseId, number>` built by counting attachments per `phase_id`
(`useProjectDetail.ts:191-197`). So on every non-Designs route the app downloads the entire
attachment list (full rows, potentially dozens-hundreds of files) purely to compute a handful
of integers for the stepper/MetaBar. The full list is only actually rendered on the Designs
tab (`phaseFiles`, `useProjectDetail.ts:199-202`).

SWR dedupes the layout's and the Designs page's calls when both mount, but on every other
route the full fetch is pure waste.

## Fix

Add a lightweight phase-count endpoint and have the layout use _that_; fetch the full
attachment list only where files render.

1. **Query fn** in `src/lib/queries/attachments.ts` (respecting the same `clientOnly` +
   latest-version-per-group semantics as `getAttachments`):
   ```sql
   WITH latest AS (
     SELECT DISTINCT ON (a.version_group) a.id, a.phase_id
     FROM attachment a
     WHERE a.project_id = $1
       -- AND a.sent_to_client_at IS NOT NULL   (when clientOnly)
     ORDER BY a.version_group, a.version DESC
   )
   SELECT phase_id, COUNT(*)::int AS count
   FROM latest
   WHERE phase_id IS NOT NULL
   GROUP BY phase_id;
   ```
   Return `{ phase_id, count }[]`. Reuse the existing `clientOnly` gating logic from
   `getAttachments` (`attachments.ts:17-20`) so client vs. team counts stay consistent.
2. **Route**: `GET /api/projects/[id]/attachments/phase-counts` under `withAuth({ projectAccess:
true })`, deriving `clientOnly` from `effectiveRole === "client"` exactly like the existing
   attachments GET (`route.ts:18,27`). Add the URL builder to `src/lib/api/routes.ts` and a
   typed fn to the attachments domain file in `src/lib/api/`.
3. **Layout / hook**: have the shared layout consume the counts endpoint instead of the full
   list. Either (a) split `useProjectDetail` so the count fetch is the default and the full
   `all=true` list becomes opt-in (`options.includeAttachments`, enabled only by DesignsTab),
   or (b) add a small `usePhaseCounts(id)` hook the layout uses, and gate the full-list SWR key
   in `useProjectDetail` behind a flag so it's `null` on non-Designs routes. Keep DesignsTab
   fetching the full list (it needs `phaseFiles`). Ensure `phaseCounts` derivation now reads
   from the counts endpoint response, not the full list.
   ⚠️ Preserve SWR dedupe: on the Designs route both the counts and the full list may load;
   that's fine (counts is cheap). The win is every _other_ route dropping the full fetch.

## Verification

- New API route test (`src/test/api/attachment-phase-counts.test.ts`): returns correct
  per-phase counts, honors `clientOnly` (client sees only `sent_to_client_at IS NOT NULL`),
  counts only the latest version per `version_group`, and enforces `projectAccess`.
- MetaBar + stepper still show correct per-phase counts on every route (unchanged UI).
- Network panel: on a non-Designs route (e.g. `/projects/[id]/boq`) the response payload for
  the attachment fetch drops from full rows to a tiny counts array; the full
  `attachments?all=true` request no longer fires there. It still fires on `/designs`.
- `npm run check` + `npm test`.

## Risks / notes

- Keep the latest-version-per-`version_group` semantics identical to `getAttachments`, or
  counts will drift from what the Designs tab shows. The `DISTINCT ON (version_group) …
ORDER BY version_group, version DESC` shape must match `attachments.ts:35-41`.
- Don't break the `clientOnly` visibility rule — clients must only count files with
  `sent_to_client_at IS NOT NULL` (`attachments.ts:18-20`).
- If `useProjectDetail` consumers elsewhere rely on `attachments` being populated, verify them
  before making the full list opt-in (grep usages of the hook's `attachments` / `phaseFiles`
  return values). DesignsTab is the known consumer of the full list.
- Consider an index supporting the count query if not already covered — `attachment(project_id,
version_group, version)` likely already backs the existing `all=true` query, so no new index
  expected; confirm.
