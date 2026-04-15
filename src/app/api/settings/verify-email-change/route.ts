import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { verifyPassword, hashPassword } from "better-auth/crypto";
import { rateLimit } from "@/lib/rateLimit";
import { parseRequest } from "@/lib/validations";
import {
  getPendingEmailChange,
  deletePendingEmailChange,
  incrementFailedAttempts,
  updateUserEmail,
  EmailTakenError,
  getAccountPasswordHash,
  getActiveEmailOtp,
  incrementOtpAttempts,
  deleteEmailOtp,
  createEmailOtp,
  cleanupExpiredOtps,
} from "@/lib/queries";
import { sendOtpEmail } from "@/lib/email";

const MAX_FAILED_ATTEMPTS = 5;

const verifySchema = z.object({
  token: z.string().uuid(),
  // Password OR OTP — one must be provided
  password: z.string().min(1).optional(),
  otp: z.string().length(6).optional(),
});

/** GET /api/settings/verify-email-change?token=... — fetch pending change info for display. */
export async function GET(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = rateLimit(`verify-email-change-get:${ip}`, {
      limit: 20,
      windowMs: 600_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const token = req.nextUrl.searchParams.get("token");
    if (!token || !z.string().uuid().safeParse(token).success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const pending = await getPendingEmailChange(token);
    if (!pending) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }
    if (new Date(pending.expires_at) < new Date()) {
      await deletePendingEmailChange(token);
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    // Check if user has a password — tells the frontend which verification to show
    const hash = await getAccountPasswordHash(pending.user_id);

    return NextResponse.json({
      oldEmail: pending.old_email,
      newEmail: pending.new_email,
      hasPassword: hash !== null,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

/** POST /api/settings/verify-email-change — confirm email change with password or OTP. */
export async function POST(req: NextRequest) {
  try {
    // IP-based rate limiting — 10 attempts per 10 minutes
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = rateLimit(`verify-email-change:${ip}`, {
      limit: 10,
      windowMs: 600_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = await parseRequest(req, verifySchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { token, password, otp } = parsed.data;

    if (!password && !otp) {
      return NextResponse.json(
        { error: "Password or verification code is required." },
        { status: 400 }
      );
    }

    const pending = await getPendingEmailChange(token);
    if (!pending) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date(pending.expires_at) < new Date()) {
      await deletePendingEmailChange(token);
      return NextResponse.json(
        { error: "This link has expired" },
        { status: 400 }
      );
    }

    // Check if token is locked out from too many failed attempts
    if (pending.failed_attempts >= MAX_FAILED_ATTEMPTS) {
      await deletePendingEmailChange(token);
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new link." },
        { status: 403 }
      );
    }

    const hash = await getAccountPasswordHash(pending.user_id);

    if (hash && password) {
      // Password-based verification
      const passwordValid = await verifyPassword({ password, hash });
      if (!passwordValid) {
        const attempts = await incrementFailedAttempts(token);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await deletePendingEmailChange(token);
          return NextResponse.json(
            { error: "Too many failed attempts. Please request a new link." },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: "Incorrect password" },
          { status: 401 }
        );
      }
    } else if (!hash && otp) {
      // OTP-based verification for Google-only users
      const activeOtp = await getActiveEmailOtp(
        pending.user_id,
        "email_change"
      );
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
            {
              error:
                "Too many failed attempts. Please request a new verification code.",
            },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: "Incorrect verification code" },
          { status: 401 }
        );
      }
      await deleteEmailOtp(activeOtp.id);
    } else {
      return NextResponse.json(
        {
          error: hash
            ? "Password is required."
            : "Verification code is required.",
        },
        { status: 400 }
      );
    }

    // Update email + invalidate sessions (unique constraint guards race conditions)
    try {
      await updateUserEmail(pending.user_id, pending.new_email);
    } catch (err) {
      if (err instanceof EmailTakenError) {
        await deletePendingEmailChange(token);
        return NextResponse.json(
          { error: "This email is already in use" },
          { status: 409 }
        );
      }
      throw err;
    }
    await deletePendingEmailChange(token);

    return NextResponse.json({ newEmail: pending.new_email });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

const sendOtpSchema = z.object({
  token: z.string().uuid(),
});

/** PUT /api/settings/verify-email-change — send OTP for Google-only users (no session required). */
export async function PUT(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rl = rateLimit(`verify-email-send-otp:${ip}`, {
      limit: 5,
      windowMs: 300_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait before requesting a new code." },
        { status: 429 }
      );
    }

    const parsed = await parseRequest(req, sendOtpSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const pending = await getPendingEmailChange(parsed.data.token);
    if (!pending || new Date(pending.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = await hashPassword(code);
    await createEmailOtp(pending.user_id, codeHash, "email_change");

    sendOtpEmail(pending.old_email, code, "email_change").catch(() => {});
    cleanupExpiredOtps().catch(() => {});

    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
