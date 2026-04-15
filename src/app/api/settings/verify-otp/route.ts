import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "better-auth/crypto";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import {
  getActiveEmailOtp,
  incrementOtpAttempts,
  deleteEmailOtp,
} from "@/lib/queries";

const verifyOtpSchema = z.object({
  otp: z.string().length(6),
  purpose: z.enum(["set_password", "email_change"]),
});

/** POST /api/settings/verify-otp — verify a 6-digit OTP code. */
export const POST = withAuth({}, async (req: NextRequest, ctx) => {
  const parsed = await parseRequest(req, verifyOtpSchema);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { otp, purpose } = parsed.data;

  const activeOtp = await getActiveEmailOtp(ctx.user.id, purpose);
  if (!activeOtp) {
    return NextResponse.json(
      { valid: false, error: "No verification code found. Please request a new one." },
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
        { valid: false, error: "Too many failed attempts. Please request a new code." },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { valid: false, error: "Incorrect verification code." },
      { status: 401 }
    );
  }

  await deleteEmailOtp(activeOtp.id);
  return NextResponse.json({ valid: true });
});
