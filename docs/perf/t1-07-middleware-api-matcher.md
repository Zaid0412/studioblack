# Exclude /api from middleware (drop redundant edge hop + fix 307-vs-401)

- **Tier / Impact / Effort:** T1 · Med · S
- **Area:** infra
- **Files:** `src/middleware.ts:39-46,55-66`, `src/lib/swr.ts:49-50`, `src/lib/withAuth.ts:125-132`

## Problem
`src/middleware.ts:56-64` matches all paths except `_next/static`, `_next/image`, static extensions, and a short allowlist (`api/auth`, `api/health`, `api/settings/verify-email-change`). It therefore **still runs on every other `/api/*` request**. Each API call pays an edge-middleware invocation — cookie-presence check (`getSessionCookie`, line 20) plus a header clone (line 50-52) — that is redundant, because `withAuth` already performs full `auth.api.getSession()` validation (`withAuth.ts:125`) and returns proper 401 JSON (line 128-131) on failure.

Worse, it's a **correctness bug**: for an unauthenticated request the middleware 307-redirects to `/login` (`middleware.ts:39-46`), which returns HTML. For an API route the caller expects `401 JSON`. A 307 to an HTML login page breaks fetch/SWR consumers and specifically defeats the 401 suppression in `src/lib/swr.ts:49-50` (which silences the toast only for `ApiError` with `status === 401` — a 307→HTML never reaches that branch).

## Fix
1. Add `api` to the matcher's negative lookahead so middleware no longer runs on any API route — `withAuth` owns API auth end to end. In `src/middleware.ts:64`, insert `api|` into the alternation:

```ts
export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|verify-email|verify-email-change|api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
```

2. This subsumes the existing `api/auth`, `api/health`, `api/settings/verify-email-change` exclusions (all now covered by the broader `api`), and eliminates the 307-vs-401 mismatch because API requests never hit the redirect branch. Page routes keep their cookie-gate + `x-pathname` forwarding unchanged.

3. Optionally simplify the now-redundant sub-path allowlist comment in the matcher block since `api` covers them.

## Verification
- Add a temporary response header in the middleware (e.g. `x-mw: 1`) and confirm `/api/*` responses no longer carry it while page routes do; then remove it.
- Unauthenticated `curl -i` to a protected `/api/*` route returns `401` JSON (`{"error":"Unauthorized"}`) with `X-Request-Id`, not a `307` to `/login`.
- Page routes: unauthenticated `GET /dashboard` still `307`s to `/login?returnTo=...`.
- SWR: trigger an expired-session API fetch client-side and confirm no error toast fires (401 branch in `swr.ts:50` now reached).
- `npm run check` green; existing API tests pass.

## Risks / notes
- Confirm no `/api/*` route relied on the `x-pathname` header the middleware injected (line 51) — API handlers read `req.nextUrl.pathname` directly (`withAuth.ts:78`), so none do.
- `api/auth` (better-auth) already handles its own auth; removing it from middleware is safe and was already excluded.
- Public API routes (`api/health`) keep working — they were excluded before and remain unmatched now.
- Net effect: one fewer edge invocation per API call and correct 401 semantics; page-route protection is unchanged.
