import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { hashPassword } from "better-auth/crypto";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { createEmailOtp, cleanupExpiredOtps } from "@/lib/queries";
import { sendOtpEmail } from "@/lib/email";

const sendOtpSchema = z.object({
  purpose: z.enum(["set_password", "email_change"]),
});

/** Generate a cryptographically random 6-digit code. */
function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/** POST /api/settings/send-otp — send a 6-digit OTP to the user's email. */
export const POST = withAuth(
  { rateLimit: { limit: 10, windowMs: 600_000 } },
  async (req: NextRequest, ctx) => {
    // Rate limit: 3 OTP sends per 5 minutes per user
    const rl = rateLimit(`send-otp:${ctx.user.id}`, {
      limit: 3,
      windowMs: 300_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait before requesting a new code.",
        },
        { status: 429 }
      );
    }

    const parsed = await parseRequest(req, sendOtpSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { purpose } = parsed.data;
    const code = generateOtpCode();
    const codeHash = await hashPassword(code);

    await createEmailOtp(ctx.user.id, codeHash, purpose);

    // Fire-and-forget: send email
    sendOtpEmail(ctx.user.email, code, purpose).catch(() => {
      // Email send failure is non-blocking — user can request again
    });

    // Opportunistic cleanup of expired OTPs
    cleanupExpiredOtps().catch(() => {});

    return NextResponse.json({ sent: true });
  }
);
