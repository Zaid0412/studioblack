# Cache per-request session + membership reads

> ✅ **Status:** Implemented in PR #183.

- **Tier / Impact / Effort:** T1 · High · M
- **Area:** data-fetching
- **Files:** `src/lib/withAuth.ts:123-125,163-168,207-212,245-249`, `src/lib/queries/roles.ts:8-95`, `src/lib/effectiveRole.ts:16-37`, `src/app/(dashboard)/layout.tsx:34-58`, `src/app/(dashboard)/organisation/layout.tsx`, `src/app/(dashboard)/projects/new/layout.tsx`, `src/app/(dashboard)/vendor-portal/layout.tsx`

## Problem

A single dashboard request resolves the **same membership facts** several times through separate serial DB round-trips:

- `withAuth` (`src/lib/withAuth.ts:125`) calls `auth.api.getSession()` (a DB session lookup).
- When `needsRole`, line 163 calls `deriveEffectiveRole` → `getMemberRole` (`roles.ts:8`) and, on project routes, `isProjectPm` (`roles.ts:25`).
- If `projectAccess`, line 207 calls `hasProjectAccess` (`roles.ts:62`) whose query already returns `org_role` **and** `is_member`.
- If `fetchOrgRole`, line 248 calls `getOrgRole` (`roles.ts:39`) which returns `org_role` **again** — a third read of the same member row.

So a project route with `projectAccess + fetchOrgRole` runs `getMemberRole`, then `hasProjectAccess` (re-reads org_role + membership), then `getOrgRole` (re-reads org_role) — 3 queries against `member`/`project_member` for one row of truth.

On top of that, the layout tree re-reads the session per segment: `src/app/(dashboard)/layout.tsx:35` calls `getSession()` and line 57 calls `deriveEffectiveRole` (which calls `getMemberRole`) while line 58 calls `getMemberRole` **again** directly. Nested layouts (`organisation/layout.tsx`, `projects/new/layout.tsx`, `vendor-portal/layout.tsx`) each call `auth.api.getSession()` a second time on top of the parent dashboard layout for the same request. RSC layouts render top-down per request, so these are additive DB hits on every navigation.

## Fix

1. **Request-scoped memoization** with React `cache()` (stable within a single server request; `headers()` is per-request stable so all layouts + `withAuth` share one entry). Create `src/lib/requestCache.ts`:

```ts
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getMemberRole } from "@/lib/queries";

export const getRequestSession = cache(async () => {
  const h = await headers();
  return auth.api.getSession({ headers: h });
});

export const getCachedMemberRole = cache((orgId: string, userId: string) =>
  getMemberRole(orgId, userId)
);
```

2. Point `deriveEffectiveRole` (`src/lib/effectiveRole.ts:26`) and both layout call sites at `getCachedMemberRole`, and replace direct `auth.api.getSession()` calls in `withAuth.ts:125` and every `(dashboard)` layout with `getRequestSession()`. In `layout.tsx`, drop the standalone `getMemberRole` on line 58 and reuse the value derived inside `deriveEffectiveRole` (or call `getCachedMemberRole` so it dedupes).

3. **Longer-term (separate follow-up, not blocking):** collapse the three membership lookups into one query returning `{ org_role, is_project_pm, is_member }` for `(projectId, userId)`, and have `deriveEffectiveRole` / `hasProjectAccess` / `getOrgRole` read from that single row. The `cache()` layer already removes the duplicate reads within a request; this removes them at the SQL level.

## Verification

- In dev, temporarily wrap `pool.query` in `src/lib/db.ts` with a counter/log keyed by `X-Request-Id` and confirm the session + member reads drop to one each per request across the layout tree.
- Existing auth tests in `src/test/api/` (any route using `withAuth` with `projectAccess`/`fetchOrgRole`) must still pass — `cache()` is transparent, roles resolve identically.
- `npm run check` green.

## Risks / notes

- `cache()` from `react` is per-render/request and must only wrap functions that are pure w.r.t. request scope — session + membership qualify (`headers()` is the stable key).
- Do not cache across requests (no module-level Map) — membership can change; `cache()` correctly resets per request.
- Watch the `orgId` fallback path (`withAuth.ts:139-144` / `layout.tsx:44-54`): `listOrganizations` / `setActiveOrganization` mutate session state, so keep those outside the memoized session read or the write won't reflect. Memoize only the read.
