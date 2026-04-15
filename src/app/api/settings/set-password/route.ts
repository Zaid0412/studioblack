import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import {
  hasCredentialAccount,
  createCredentialAccount,
} from "@/lib/queries";

const setPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

/** POST /api/settings/set-password — set a password for a Google-only user (after OTP verification). */
export const POST = withAuth({}, async (req: NextRequest, ctx) => {
  const parsed = await parseRequest(req, setPasswordSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { newPassword } = parsed.data;

  // Only allow if user doesn't already have a password
  const hasPassword = await hasCredentialAccount(ctx.user.id);
  if (hasPassword) {
    return NextResponse.json(
      { error: "Account already has a password. Use change password instead." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await createCredentialAccount(ctx.user.id, passwordHash);

  return NextResponse.json({ success: true });
});
