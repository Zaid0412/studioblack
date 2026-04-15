import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { hasCredentialAccount } from "@/lib/queries";

/** GET /api/settings/has-password — check if the current user has a password. */
export const GET = withAuth({}, async (_req, ctx) => {
  const hasPassword = await hasCredentialAccount(ctx.user.id);
  return NextResponse.json({ hasPassword });
});
