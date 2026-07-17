import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/env";
import { runRfqReminders } from "@/lib/rfqReminders";
import { logger } from "@/lib/logger";

// Reads a request header and sends email — never statically optimised/cached.
export const dynamic = "force-dynamic";
// Sends emails sequentially; give the batch headroom over the 10s default.
export const maxDuration = 60;

/** Constant-time bearer check — avoids leaking the secret through timing. */
function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/cron/rfq-reminders — the daily RFQ response-reminder job.
 *
 * Deliberately NOT behind `withAuth`: it's a machine endpoint with no user
 * session, so it can't pass the session + same-origin CSRF checks. Vercel Cron
 * (see vercel.json) invokes it with `Authorization: Bearer <CRON_SECRET>`. It
 * refuses to run unless CRON_SECRET is set and matches, so it can't be triggered
 * publicly.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = env().CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (!authorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRfqReminders();
    logger.info("RFQ reminder run", { ...result });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("RFQ reminder run failed", { err: String(err) });
    return NextResponse.json({ error: "Reminder run failed" }, { status: 500 });
  }
}
