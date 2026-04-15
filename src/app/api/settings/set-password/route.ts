import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import {
  hasCredentialAccount,
  createCredentialAccount,
  getActiveEmailOtp,
  incrementOtpAttempts,
  deleteEmailOtp,
} from "@/lib/queries";

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

  // Only allow if user doesn't already have a password
  const hasPassword = await hasCredentialAccount(ctx.user.id);
  if (hasPassword) {
    return NextResponse.json(
      { error: "Account already has a password. Use change password instead." },
      { status: 400 }
    );
  }

  // Verify OTP server-side
  const activeOtp = await getActiveEmailOtp(ctx.user.id, "set_password");
  if (!activeOtp) {
    return NextResponse.json(
      { error: "No verification code found. Please request a new one." },
      { status: 400 }
    );
  }

  const otpValid = await verifyPassword({
    password: otp,
    hash: activeOtp.code_hash,
  });

  if (!otpValid) {
    const attempts = await incrementOtpAttempts(activeOtp.id);
    if (attempts >= 5) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new code." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Incorrect verification code." },
      { status: 401 }
    );
  }

  // OTP valid — delete it and set the password
  await deleteEmailOtp(activeOtp.id);
  const passwordHash = await hashPassword(newPassword);
  await createCredentialAccount(ctx.user.id, passwordHash);

  return NextResponse.json({ success: true });
});
