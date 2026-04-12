import nodemailer from "nodemailer";
import { branding } from "@/config/branding";
import { env } from "@/env";
import { logger } from "@/lib/logger";

/** Escape HTML special characters to prevent injection. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!_transport) {
    const e = env();
    _transport = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: Number(e.SMTP_PORT),
      secure: false,
      requireTLS: true,
      auth: {
        user: e.SMTP_USER,
        pass: e.SMTP_PASS,
      },
    });
  }
  return _transport;
}

function getFromEmail(): string {
  return env().EMAIL_FROM || `${branding.appName} <noreply@studioblack.com>`;
}

function getEnvTag(): string {
  return env().NODE_ENV === "production" ? "" : "[STAGING] ";
}

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await getTransport().sendMail({ from: getFromEmail(), to, subject, html });
  } catch (err) {
    logger.error("Failed to send email", { to, subject, error: err });
  }
}

/**
 * Send a magic link email to a client for project access.
 */
export async function sendMagicLinkEmail(email: string, url: string) {
  const safeUrl = escapeHtml(url);
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} — Access Your Project`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${escapeHtml(branding.appName)}</h2>
        <p>You've been invited to review a project. Click the link below to access your project dashboard:</p>
        <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background: #F5C518; color: #0D0D0D; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
          View Project
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          This link expires in 15 minutes. If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `
  );
}

/**
 * Send a notification email (project updates, review requests, etc.).
 * Body is pre-escaped HTML — callers must use escapeHtml() on user data.
 */
export async function sendNotificationEmail(
  email: string,
  subject: string,
  body: string
) {
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} — ${escapeHtml(subject)}`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${escapeHtml(branding.appName)}</h2>
        ${body}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">${escapeHtml(branding.tagline)}</p>
      </div>
    `
  );
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(email: string, url: string) {
  const safeUrl = escapeHtml(url);
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} — Reset Your Password`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${escapeHtml(branding.appName)}</h2>
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background: #F5C518; color: #0D0D0D; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `
  );
}

/**
 * Send an org invitation email.
 */
export async function sendInvitationEmail(
  email: string,
  inviterName: string,
  orgName: string,
  inviteLink: string
) {
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} — You've been invited to ${escapeHtml(orgName)}`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${escapeHtml(branding.appName)}</h2>
        <p><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(orgName)}</strong>.</p>
        <a href="${escapeHtml(inviteLink)}" style="display: inline-block; padding: 12px 24px; background: #F5C518; color: #0D0D0D; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          If you don't have an account yet, you'll be prompted to create one.
        </p>
      </div>
    `
  );
}
