import path from "path";
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

// ---------------------------------------------------------------------------
// Design tokens (matching Pencil designs)
// ---------------------------------------------------------------------------
const font =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const colors = {
  pageBg: "#f4f4f5",
  cardBg: "#0d0d0d",
  accent: "#F5C518",
  accentDark: "#D4A017",
  white: "#ffffff",
  textPrimary: "#ffffff",
  textMuted: "#a1a1aa",
  textHint: "#71717a",
  textDark: "#0d0d0d",
  divider: "#27272a",
  footerText: "#52525b",
  warnBg: "#1a1910",
  warnBorder: "#2a2518",
} as const;

const safeBrandName = escapeHtml(branding.appName);
const safeTagline = escapeHtml(branding.tagline);

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Gold CTA button — full-width, table-based for email client compatibility. */
function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0;">
      <tr>
        <td align="center">
          <a href="${href}" target="_blank" style="display: block; width: 100%; padding: 16px 24px; background-color: ${colors.accent}; color: ${colors.textDark}; text-decoration: none; border-radius: 12px; font-family: ${font}; font-size: 15px; font-weight: 600; text-align: center; box-sizing: border-box;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Amber warning / info box (e.g. "This link expires in 1 hour"). */
function warningBox(text: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 4px 0;">
      <tr>
        <td style="background-color: ${colors.warnBg}; border: 1px solid ${colors.warnBorder}; border-radius: 10px; padding: 14px 16px; font-family: ${font}; font-size: 13px; font-weight: 500; color: ${colors.accent};">
          ${text}
        </td>
      </tr>
    </table>`;
}

/** Dark pill showing an org name. */
function orgPill(orgName: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="background-color: #18181b; border: 1px solid ${colors.divider}; border-radius: 12px; padding: 12px 24px; font-family: ${font}; font-size: 14px; font-weight: 600; color: ${colors.white};">
          ${orgName}
        </td>
      </tr>
    </table>`;
}

/** Horizontal divider line inside the card. */
function divider(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr><td style="height: 1px; background-color: ${colors.divider}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
    </table>`;
}

/**
 * Full email document wrapper.
 * @param title   - Bold heading text
 * @param body    - Main HTML content (description, buttons, etc.)
 * @param footer  - Contextual disclaimer shown below the card
 */
function emailLayout(title: string, body: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,sans-serif;}</style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.pageBg}; -webkit-text-size-adjust: 100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${colors.pageBg};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <img src="cid:logo" alt="" width="180" style="display: block; width: 180px; height: auto;" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${colors.cardBg}; border-radius: 16px; overflow: hidden;">
                <!-- Gold accent bar -->
                <tr>
                  <td style="height: 4px; background-color: ${colors.accent}; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                <!-- Card body -->
                <tr>
                  <td style="padding: 36px 40px 40px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <!-- Title -->
                      <tr>
                        <td align="center" style="padding-bottom: 16px; font-family: ${font}; font-size: 24px; font-weight: 700; color: ${colors.textPrimary};">
                          ${title}
                        </td>
                      </tr>
                      <!-- Body content -->
                      <tr>
                        <td style="font-family: ${font};">
                          ${body}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-family: ${font}; font-size: 12px; color: ${colors.textMuted}; padding-bottom: 8px;">
                    ${safeTagline}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family: ${font}; font-size: 11px; color: ${colors.textHint}; line-height: 1.5; padding-bottom: 8px;">
                    ${footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Send helper
// ---------------------------------------------------------------------------

const logoPath = path.join(process.cwd(), "public", "logo-dark.png");

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await getTransport().sendMail({
      from: getFromEmail(),
      to,
      subject,
      html,
      attachments: [
        {
          filename: "logo.png",
          path: logoPath,
          cid: "logo",
        },
      ],
    });
  } catch (err) {
    logger.error("Failed to send email", { to, subject, error: err });
  }
}

// ---------------------------------------------------------------------------
// Public email functions
// ---------------------------------------------------------------------------

/**
 * Send a magic link email to a client for project access.
 */
export async function sendMagicLinkEmail(email: string, url: string) {
  const safeUrl = escapeHtml(url);
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} — Access Your Project`,
    emailLayout(
      "Access Your Project",
      `<p style="font-size: 14px; color: ${colors.textMuted}; text-align: center; line-height: 1.6; margin: 0 0 24px;">
        You&#039;ve been invited to review a project on ${safeBrandName}. Click the button below to access your project dashboard.
      </p>
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(safeUrl, "View Project")}
      </div>
      <p style="font-size: 12px; color: ${colors.textHint}; text-align: center; margin: 16px 0 0;">
        This link expires in 15 minutes.
      </p>`,
      "If you didn&#039;t expect this email, you can safely ignore it."
    )
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
    emailLayout(
      escapeHtml(subject),
      `<div style="font-size: 14px; color: ${colors.textMuted}; line-height: 1.6;">
        ${body}
      </div>`,
      "This is an automated notification from " + safeBrandName + "."
    )
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
    emailLayout(
      "Reset Your Password",
      `<p style="font-size: 14px; color: ${colors.textMuted}; text-align: center; line-height: 1.6; margin: 0 0 24px;">
        We received a request to reset the password for your account. Click the button below to choose a new one.
      </p>
      ${warningBox("This link expires in 1 hour")}
      <div style="padding-top: 16px;">
        ${divider()}
      </div>
      <div style="padding-top: 24px;">
        ${ctaButton(safeUrl, "Reset Password")}
      </div>
      <p style="font-size: 12px; color: ${colors.textHint}; text-align: center; line-height: 1.5; margin: 16px 0 0;">
        If you didn&#039;t request a password reset, you can safely ignore this email. Your password will remain unchanged.
      </p>`,
      "This is an automated email from " + safeBrandName + ". Please do not reply directly."
    )
  );
}

/**
 * Send a verification email after registration.
 */
export async function sendVerificationEmail(
  email: string,
  name: string,
  url: string
) {
  const safeUrl = escapeHtml(url);
  const safeName = escapeHtml(name);
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} — Verify Your Email`,
    emailLayout(
      "Verify Your Email",
      `<p style="font-size: 14px; color: ${colors.textMuted}; text-align: center; line-height: 1.6; margin: 0 0 24px;">
        Hi ${safeName}, thanks for signing up! Please verify your email address to get started with ${safeBrandName}.
      </p>
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(safeUrl, "Verify Email Address")}
      </div>
      <p style="font-size: 12px; color: ${colors.textHint}; text-align: center; margin: 16px 0 0;">
        This link expires in 24 hours.
      </p>`,
      "If you didn&#039;t create an account, you can safely ignore this email."
    )
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
    emailLayout(
      "You&#039;re Invited",
      `<p style="font-size: 14px; color: ${colors.textMuted}; text-align: center; line-height: 1.6; margin: 0 0 16px;">
        <strong style="color: ${colors.white};">${escapeHtml(inviterName)}</strong> has invited you to join
      </p>
      <div style="text-align: center; margin: 0 0 24px;">
        ${orgPill(escapeHtml(orgName))}
      </div>
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(escapeHtml(inviteLink), "Accept Invitation")}
      </div>
      <p style="font-size: 12px; color: ${colors.textHint}; text-align: center; margin: 16px 0 0;">
        If you don&#039;t have an account yet, you&#039;ll be prompted to create one.
      </p>`,
      "If you weren&#039;t expecting this invitation, you can safely ignore this email."
    )
  );
}

/**
 * Send a verification email for an email address change.
 */
export async function sendChangeEmailVerification(
  newEmail: string,
  name: string,
  url: string
) {
  const safeUrl = escapeHtml(url);
  const safeName = escapeHtml(name);
  await sendEmail(
    newEmail,
    `${getEnvTag()}${branding.appName} — Confirm Your New Email`,
    emailLayout(
      "Confirm Your New Email",
      `<p style="font-size: 14px; color: ${colors.textMuted}; text-align: center; line-height: 1.6; margin: 0 0 24px;">
        Hi ${safeName}, you requested to change your email address to this one. Click the button below to confirm.
      </p>
      ${warningBox("You&#039;ll need to enter your account password to complete the change")}
      <div style="padding-top: 16px;">
        ${divider()}
      </div>
      <div style="padding-top: 24px;">
        ${ctaButton(safeUrl, "Confirm New Email")}
      </div>
      <p style="font-size: 12px; color: ${colors.textHint}; text-align: center; margin: 16px 0 0;">
        This link expires in 24 hours.
      </p>`,
      "If you didn&#039;t request this, you can safely ignore this email."
    )
  );
}
