# Right-size the pg pool for serverless + confirm the Supabase pooler

> ✅ **Status:** Implemented in PR #183.

- **Tier / Impact / Effort:** T1 · Med · S
- **Area:** infra
- **Files:** `src/lib/db.ts:20-25`, `.env.local.example:12`

## Problem

`src/lib/db.ts:20-25` creates the pool with `max: 5`, `idleTimeoutMillis: 30000`. On Vercel each **warm serverless instance** keeps its own pool of up to 5 connections. Under concurrency the platform spins up N instances, so total Postgres connections trend toward `5 × N`. Supabase direct-connection limits are low (tens of connections on smaller tiers), so a traffic spike can exhaust them and start failing `connectionTimeoutMillis` (5s) with connection errors.

`.env.local.example:12` correctly points at the Supabase **transaction pooler**: `postgresql://USER:PASS@HOST:6543/postgres?pgbouncer=true`. The pooler (port 6543) multiplexes many client connections onto a small server pool, which is exactly what serverless needs — but only if production's `DATABASE_URL` actually uses `:6543` and `max` is set appropriately for it.

## Fix

1. **Confirm prod env** — verify Vercel's `DATABASE_URL` (Production + Preview) uses `:6543` with `?pgbouncer=true`, **not** the direct `:5432`. If it's on `:5432`, switch it to the pooler string. (Check via Vercel project env vars; do not hardcode in the repo.)

2. **Lower `max` per instance** once on the pooler — the pooler, not the app pool, does the real connection sharing, so each instance needs very few client-side connections:

```ts
globalForPg.pgPool = new Pool({
  connectionString: env().DATABASE_URL,
  max: 2, // was 5 — with the :6543 transaction pooler, 1–2 is enough per instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

3. **No named prepared statements** — pgbouncer transaction mode breaks server-side named prepared statements. The codebase uses `pool.query(text, values)` throughout (see `src/lib/queries/roles.ts`), which sends unnamed/simple parameterized queries — safe. Add a short comment near the pool config noting "transaction-pooler safe: no named prepared statements" so future changes don't introduce `pool.query({ name, text, values })`.

## Verification

- Inspect prod/preview `DATABASE_URL` port = 6543 and `pgbouncer=true` present.
- Load-test or watch Supabase dashboard → Database → connection count under concurrent traffic; confirm it stays well under the tier limit and doesn't climb with instance count.
- Existing API tests unaffected (queries are already unnamed parameterized) — `npm test` green.

## Risks / notes

- Combine with `t1-01` (idempotent shutdown) — both touch `db.ts`.
- If any future feature needs session-level features (e.g. `LISTEN/NOTIFY`, advisory locks, `SET` that persists across statements) it must use the **session** pooler (also 6543 but session mode) or a direct connection — those don't work under transaction pooling. None exist today.
- `max: 1` is the most conservative; `2` gives a little headroom for a slow query not blocking a second concurrent request on the same warm instance. Pick based on observed p95 query time.
