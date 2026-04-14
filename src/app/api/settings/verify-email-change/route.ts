import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "better-auth/crypto";
import { rateLimit } from "@/lib/rateLimit";
import { parseRequest } from "@/lib/validations";
import {
  getPendingEmailChange,
  deletePendingEmailChange,
  incrementFailedAttempts,
  isEmailTaken,
  updateUserEmail,
  getAccountPasswordHash,
} from "@/lib/queries";

const MAX_FAILED_ATTEMPTS = 5;

const verifySchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(1),
});

/** GET /api/settings/verify-email-change?token=... — fetch pending change info for display. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || !z.string().uuid().safeParse(token).success) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const pending = await getPendingEmailChange(token);
  if (!pending || new Date(pending.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired link" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    oldEmail: pending.old_email,
    newEmail: pending.new_email,
  });
}

/** POST /api/settings/verify-email-change — confirm email change with password. */
export async function POST(req: NextRequest) {
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

  const { token, password } = parsed.data;

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

  // Verify password
  const hash = await getAccountPasswordHash(pending.user_id);
  if (!hash) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Check email isn't taken (race condition guard)
  const taken = await isEmailTaken(pending.new_email);
  if (taken) {
    await deletePendingEmailChange(token);
    return NextResponse.json(
      { error: "This email is already in use" },
      { status: 409 }
    );
  }

  // Update email + invalidate sessions
  await updateUserEmail(pending.user_id, pending.new_email);
  await deletePendingEmailChange(token);

  return NextResponse.json({
    status: true,
    newEmail: pending.new_email,
  });
}
