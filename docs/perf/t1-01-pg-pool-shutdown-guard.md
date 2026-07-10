# Make the pg pool shutdown handler idempotent

- **Tier / Impact / Effort:** T1 · High · S
- **Area:** infra
- **Files:** `src/lib/db.ts:30-32`, `src/lib/auth.ts:320-335`

## Problem
`src/lib/db.ts:30` registers `const shutdown = () => globalForPg.pgPool?.end();` on **both** `process.once("SIGTERM")` (line 31) and `process.once("SIGINT")` (line 32). `pg`'s `pool.end()` throws `Called end on pool more than once` if invoked twice, and the returned promise is discarded (no `await`, no `.catch`) so the rejection is unhandled.

The pool is created **at module import / build time**, not lazily on first request: `src/lib/auth.ts:320-335` runs `getPool().query(...)` at module top-level, gated only on `features.emailVerification`. When the build process later receives both SIGINT and SIGTERM (or the same signal twice), the second `shutdown()` call rejects with `Called end on pool more than once` — the observed build error. Each handler also returns a floating promise, so even a single throw surfaces as an unhandled rejection.

## Fix
1. In `getPool()` (`src/lib/db.ts`), replace the single-line shutdown with an idempotent, self-catching version:

```ts
// Drain connections on graceful shutdown (relevant for long-lived processes)
let ended = false;
const shutdown = () => {
  if (ended) return;
  ended = true;
  // Swallow "Called end on pool more than once" and any drain error —
  // we're shutting down, nothing to recover.
  void globalForPg.pgPool?.end().catch(() => {});
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
```

2. `ended` lives in the closure created on first `getPool()` call; both signal handlers share it, so whichever fires first wins and the rest are no-ops. `void` + `.catch(() => {})` guarantees no floating/unhandled rejection.

3. No change needed at the `auth.ts` call site — the guard makes the existing build-time pool creation safe.

## Verification
- Run the production build (`npm run build`) and confirm the log no longer contains `Called end on pool more than once`.
- Optional unit test in `src/test/unit/db.test.ts`: import `getPool`, capture the registered handler via a mocked `process.once`, stub `pool.end` to resolve once and reject on the 2nd call, invoke the handler twice, assert it does not throw and `end` is called exactly once.
- `npm run check` (lint + tsc) stays green — the change is local and typed.

## Risks / notes
- `ended` is per-pool-instance (reset if the pool is recreated after a dev HMR cycle), which is correct — a fresh pool should be drainable again.
- Behavior on a real single graceful shutdown is unchanged: connections still drain once.
- Does not address pool sizing / pooler config — see `t1-06-pg-pool-max-pooler.md`.
