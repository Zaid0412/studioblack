import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

/** GET /api/health — public health check with DB probe. */
export async function GET() {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return NextResponse.json({
      status: "ok",
      db: "ok",
      ts: Date.now(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: "unreachable", ts: Date.now() },
      { status: 503 }
    );
  }
}
