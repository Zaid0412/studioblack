import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "better-auth/crypto";
import {
  getPendingEmailChange,
  deletePendingEmailChange,
  isEmailTaken,
  updateUserEmail,
  getAccountPasswordHash,
} from "@/lib/queries";

const verifySchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(1),
});

/** POST /api/settings/verify-email-change — confirm email change with password. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
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

  // Verify password
  const hash = await getAccountPasswordHash(pending.user_id);
  if (!hash) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const passwordValid = await verifyPassword({ password, hash });
  if (!passwordValid) {
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

  // Update email
  await updateUserEmail(pending.user_id, pending.new_email);
  await deletePendingEmailChange(token);

  return NextResponse.json({ status: true });
}
