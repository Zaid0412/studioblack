import crypto from "crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import {
  getActiveEmailOtp,
  incrementOtpAttempts,
  deleteEmailOtp,
  createEmailOtp,
  cleanupExpiredOtps,
  type OtpPurpose,
} from "@/lib/queries";
import { sendOtpEmail } from "@/lib/email";

export const OTP_MAX_ATTEMPTS = 5;

/** Generate a cryptographically random 6-digit code. */
export function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string; status: 400 | 401 | 403 };

/** Verify a 6-digit OTP for a user+purpose. Handles attempts and cleanup. */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string
): Promise<VerifyOtpResult> {
  const activeOtp = await getActiveEmailOtp(userId, purpose);
  if (!activeOtp) {
    return {
      ok: false,
      error: "No verification code found. Please request a new one.",
      status: 400,
    };
  }

  const valid = await verifyPassword({
    password: code,
    hash: activeOtp.code_hash,
  });

  if (!valid) {
    const attempts = await incrementOtpAttempts(activeOtp.id);
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return {
        ok: false,
        error: "Too many failed attempts. Please request a new code.",
        status: 403,
      };
    }
    return {
      ok: false,
      error: "Incorrect verification code.",
      status: 401,
    };
  }

  await deleteEmailOtp(activeOtp.id);
  return { ok: true };
}

/** Generate, store, and send an OTP code to the given email. */
export async function generateAndSendOtp(
  userId: string,
  email: string,
  purpose: OtpPurpose
): Promise<void> {
  const code = generateOtpCode();
  const codeHash = await hashPassword(code);
  await createEmailOtp(userId, codeHash, purpose);
  await sendOtpEmail(email, code, purpose);
  cleanupExpiredOtps().catch(() => {});
}
