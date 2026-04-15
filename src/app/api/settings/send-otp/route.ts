import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import { rateLimit } from "@/lib/rateLimit";
import { generateAndSendOtp } from "@/lib/otp";

const sendOtpSchema = z.object({
  purpose: z.enum(["set_password", "email_change"]),
});

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

    try {
      await generateAndSendOtp(
        ctx.user.id,
        ctx.user.email,
        parsed.data.purpose
      );
    } catch {
      return NextResponse.json(
        { error: "Could not send verification code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent: true });
  }
);
