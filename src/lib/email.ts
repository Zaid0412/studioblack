import nodemailer from "nodemailer";
import { branding } from "@/config/branding";

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return _transport;
}

const FROM_EMAIL =
  process.env.EMAIL_FROM || `${branding.appName} <noreply@studioblack.com>`;

const ENV_TAG = process.env.NODE_ENV === "production" ? "" : "[STAGING] ";

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await getTransport().sendMail({ from: FROM_EMAIL, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}

/**
 * Send a magic link email to a client for project access.
 */
export async function sendMagicLinkEmail(email: string, url: string) {
  await sendEmail(
    email,
    `${ENV_TAG}${branding.appName} — Access Your Project`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${branding.appName}</h2>
        <p>You've been invited to review a project. Click the link below to access your project dashboard:</p>
        <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #F5C518; color: #0D0D0D; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
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
 */
export async function sendNotificationEmail(
  email: string,
  subject: string,
  body: string
) {
  await sendEmail(
    email,
    `${ENV_TAG}${branding.appName} — ${subject}`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${branding.appName}</h2>
        ${body}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">${branding.tagline}</p>
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
    `${ENV_TAG}${branding.appName} — You've been invited to ${orgName}`,
    `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #111;">${branding.appName}</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong>.</p>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #F5C518; color: #0D0D0D; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          If you don't have an account yet, you'll be prompted to create one.
        </p>
      </div>
    `
  );
}
