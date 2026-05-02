import { NextResponse } from "next/server";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { getPool } from "@/lib/db";

/**
 * Vendor portal is gated behind a PostHog feature flag. All vendor-portal
 * routes call this first so that disabling the flag immediately neutralises
 * the surface area, even if a vendor user is already logged in.
 */
export async function ensureVendorPortalEnabled(
  userId: string
): Promise<NextResponse | null> {
  const enabled = await getServerFeatureFlag("vendorPortal", userId, false);
  if (!enabled) {
    return NextResponse.json(
      { error: "Vendor portal is not enabled" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Suspended vendor (`status = 'inactive'`) — `/me` GET still works, but every
 * write endpoint refuses. Returns 403 with a stable error code so the client
 * can render the suspension banner.
 */
export async function ensureVendorActive(
  vendorId: string
): Promise<NextResponse | null> {
  const pool = getPool();
  const { rows } = await pool.query(`SELECT status FROM vendor WHERE id = $1`, [
    vendorId,
  ]);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }
  if (rows[0].status === "inactive") {
    return NextResponse.json(
      { error: "Vendor account is suspended", code: "vendor_suspended" },
      { status: 403 }
    );
  }
  return null;
}
