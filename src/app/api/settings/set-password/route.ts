import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import { createCredentialAccount } from "@/lib/queries";
import { verifyOtp } from "@/lib/otp";

const setPasswordSchema = z.object({
  otp: z.string().length(6),
  newPassword: z.string().min(8),
});

/** POST /api/settings/set-password — verify OTP + set password atomically for Google-only users. */
export const POST = withAuth({}, async (req: NextRequest, ctx) => {
  const parsed = await parseRequest(req, setPasswordSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { otp, newPassword } = parsed.data;

  // Verify OTP
  const result = await verifyOtp(ctx.user.id, "set_password", otp);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  // OTP valid — set the password (ON CONFLICT guards concurrent requests)
  const passwordHash = await hashPassword(newPassword);
  await createCredentialAccount(ctx.user.id, passwordHash);

  return NextResponse.json({ success: true });
});
