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

const globalForMail = globalThis as unknown as {
  mailTransport?: nodemailer.Transporter;
};

function getTransport(): nodemailer.Transporter {
  if (!globalForMail.mailTransport) {
    const e = env();
    globalForMail.mailTransport = nodemailer.createTransport({
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
  return globalForMail.mailTransport;
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
// Escaping contract:
// - emailLayout, ctaButton, warningBox, orgPill → self-escape all parameters
// - bodyText, hintText → accept pre-built HTML (caller is responsible)
// - divider → no parameters
// ---------------------------------------------------------------------------

/** Centered body paragraph. */
function bodyText(content: string): string {
  return `<p style="font-size: 14px; color: ${colors.textMuted}; text-align: center; line-height: 1.6; margin: 0 0 24px;">${content}</p>`;
}

/** Small hint text below the CTA. */
function hintText(content: string): string {
  return `<p style="font-size: 12px; color: ${colors.textHint}; text-align: center; line-height: 1.5; margin: 16px 0 0;">${content}</p>`;
}

/** Gold CTA button — full-width, table-based for email client compatibility. Self-escapes href and label. */
function ctaButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 8px 0;">
      <tr>
        <td align="center">
          <a href="${safeHref}" target="_blank" style="display: block; width: 100%; padding: 16px 24px; background-color: ${colors.accent}; color: ${colors.textDark}; text-decoration: none; border-radius: 12px; font-family: ${font}; font-size: 15px; font-weight: 600; text-align: center; box-sizing: border-box;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Amber warning / info box (e.g. "This link expires in 1 hour"). Self-escapes text. */
function warningBox(text: string): string {
  const safeText = escapeHtml(text);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 4px 0;">
      <tr>
        <td style="background-color: ${colors.warnBg}; border: 1px solid ${colors.warnBorder}; border-radius: 10px; padding: 14px 16px; font-family: ${font}; font-size: 13px; font-weight: 500; color: ${colors.accent};">
          ${safeText}
        </td>
      </tr>
    </table>`;
}

/** Dark pill showing an org name. Self-escapes orgName. */
function orgPill(orgName: string): string {
  const safeName = escapeHtml(orgName);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
      <tr>
        <td style="background-color: #18181b; border: 1px solid ${colors.divider}; border-radius: 12px; padding: 12px 24px; font-family: ${font}; font-size: 14px; font-weight: 600; color: ${colors.white};">
          ${safeName}
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
 * Full email document wrapper. Escapes title and footer internally —
 * callers should pass raw (unescaped) strings.
 * @param title   - Bold heading text (will be escaped)
 * @param body    - Main HTML content (pre-built, NOT escaped here)
 * @param footer  - Contextual disclaimer shown below the card (will be escaped)
 */
function emailLayout(title: string, body: string, footer: string): string {
  const safeTitle = escapeHtml(title);
  const safeFooter = escapeHtml(footer);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${safeTitle}</title>
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
                          ${safeTitle}
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
                    ${safeFooter}
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

/**
 * Extra (non-logo) attachment that callers can include with an email.
 * Either `path` (file on disk) or `content` (Buffer / string) must be set.
 * Anything beyond filename + payload — disposition, cid, encoding — is
 * passed through to nodemailer's Attachment shape.
 */
export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: { critical?: boolean; attachments?: EmailAttachment[] }
) {
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
        ...(opts?.attachments ?? []),
      ],
    });
  } catch (err) {
    logger.error("Failed to send email", { to, subject, error: err });
    if (opts?.critical) throw err;
  }
}

// ---------------------------------------------------------------------------
// Public email functions
// ---------------------------------------------------------------------------

/**
 * Send a magic link email to a client for project access.
 */
export async function sendMagicLinkEmail(email: string, url: string) {
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} | Access Your Project`,
    emailLayout(
      "Access Your Project",
      `${bodyText(`You've been invited to review a project on ${safeBrandName}. Click the button below to access your project dashboard.`)}
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(url, "View Project")}
      </div>
      ${hintText("This link expires in 15 minutes.")}`,
      "If you didn't expect this email, you can safely ignore it."
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
    `${getEnvTag()}${branding.appName} | ${subject}`,
    emailLayout(
      subject,
      `<div style="font-size: 14px; color: ${colors.textMuted}; line-height: 1.6;">
        ${body}
      </div>`,
      "This is an automated notification from " + safeBrandName + "."
    )
  );
}

/**
 * Send the "BOQ sent to client" email with the rendered PDF attached and
 * a portal CTA. Caller passes the already-rendered PDF buffer so the email
 * helper stays free of `@react-pdf/renderer` (heavy dependency).
 *
 * `bodyText` is the pre-escaped HTML opener — callers escape any user data
 * (actor name, item count, BOQ title, free-text comment) before passing.
 * If `pdfBuffer` is null (e.g. render failed or skipped due to size cap),
 * the email still ships with the body + CTA — the client just won't see
 * the attached PDF.
 */
export async function sendClientBoqEmail(opts: {
  to: string;
  subject: string;
  bodyHtml: string;
  portalUrl: string;
  pdfBuffer: Buffer | null;
  pdfFilename: string;
}) {
  const { to, subject, bodyHtml, portalUrl, pdfBuffer, pdfFilename } = opts;
  await sendEmail(
    to,
    `${getEnvTag()}${branding.appName} | ${subject}`,
    emailLayout(
      subject,
      `<div style="font-size: 14px; color: ${colors.textMuted}; line-height: 1.6;">
        ${bodyHtml}
      </div>
      ${pdfBuffer ? warningBox("📎 The full BoQ is attached as a PDF — scroll to the bottom of this email to download it.") : ""}
      <div style="padding-top: 24px;">
        ${divider()}
      </div>
      <div style="padding-top: 24px;">
        ${ctaButton(portalUrl, "Review in portal")}
      </div>`,
      "This is an automated notification from " + safeBrandName + "."
    ),
    pdfBuffer
      ? {
          attachments: [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        }
      : undefined
  );
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(email: string, url: string) {
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} | Reset Your Password`,
    emailLayout(
      "Reset Your Password",
      `${bodyText("We received a request to reset the password for your account. Click the button below to choose a new one.")}
      ${warningBox("This link expires in 1 hour")}
      <div style="padding-top: 16px;">
        ${divider()}
      </div>
      <div style="padding-top: 24px;">
        ${ctaButton(url, "Reset Password")}
      </div>
      ${hintText("If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.")}`,
      "This is an automated email from " +
        safeBrandName +
        ". Please do not reply directly."
    ),
    { critical: true }
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
  const safeName = escapeHtml(name);
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} | Verify Your Email`,
    emailLayout(
      "Verify Your Email",
      `${bodyText(`Hi ${safeName}, thanks for signing up! Please verify your email address to get started with ${safeBrandName}.`)}
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(url, "Verify Email Address")}
      </div>
      ${hintText("This link expires in 24 hours.")}`,
      "If you didn't create an account, you can safely ignore this email."
    ),
    { critical: true }
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
    `${getEnvTag()}${branding.appName} | You've been invited to ${escapeHtml(orgName)}`,
    emailLayout(
      "You're Invited",
      `${bodyText(`<strong style="color: ${colors.white};">${escapeHtml(inviterName)}</strong> has invited you to join`)}
      <div style="text-align: center; margin: 0 0 24px;">
        ${orgPill(orgName)}
      </div>
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(inviteLink, "Accept Invitation")}
      </div>
      ${hintText("If you don't have an account yet, you'll be prompted to create one.")}`,
      "If you weren't expecting this invitation, you can safely ignore this email."
    )
  );
}

/**
 * Notify a vendor contact that a new RFQ has been issued to them. Deep link
 * lands on the vendor portal's RFQ detail; the contact must already have
 * an account, otherwise the link bounces them through sign-in first.
 *
 * Fire-and-forget at the caller — never block the route on per-email SMTP
 * latency. Per-send failures are logged inside `sendEmail`.
 */
export async function sendRfqIssuedEmail(
  email: string,
  args: {
    contactName: string;
    vendorName: string;
    projectName: string;
    rfqNumber: string;
    rfqTitle: string;
    responseDeadline: string | null;
    deepLink: string;
    /** >0 when this issue is an RFQ revision — changes the wording (PRD §24). */
    revisionNumber: number;
  }
) {
  const safeContact = escapeHtml(args.contactName);
  const safeProject = escapeHtml(args.projectName);
  const isRevision = args.revisionNumber > 0;
  const deadline = args.responseDeadline
    ? `Response due by <strong style="color: ${colors.white};">${escapeHtml(args.responseDeadline)}</strong>.`
    : "";
  const subject = isRevision
    ? `${getEnvTag()}${branding.appName} | RFQ Revision ${escapeHtml(args.rfqNumber)} · Rev ${args.revisionNumber}`
    : `${getEnvTag()}${branding.appName} | New RFQ ${escapeHtml(args.rfqNumber)}`;
  const heading = isRevision ? "RFQ Revision Issued" : "New RFQ Issued";
  const intro = isRevision
    ? `Hi ${safeContact}, the RFQ on <strong style="color: ${colors.white};">${safeProject}</strong> has been revised. Please submit a revised quotation.`
    : `Hi ${safeContact}, you've been invited to submit a quote on <strong style="color: ${colors.white};">${safeProject}</strong>.`;
  const revLabel = isRevision ? ` · Rev ${args.revisionNumber}` : "";
  await sendEmail(
    email,
    subject,
    emailLayout(
      heading,
      `${bodyText(intro)}
      <div style="text-align: center; margin: 0 0 24px;">
        ${orgPill(`${args.rfqNumber}${revLabel} — ${args.rfqTitle}`)}
      </div>
      ${deadline ? bodyText(deadline) : ""}
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(args.deepLink, isRevision ? "View revised RFQ" : "View RFQ")}
      </div>
      ${hintText(isRevision ? "Open the link to review the changes and submit your revised quote." : "Open the link to review the scope and submit your quote.")}`,
      "If you weren't expecting this RFQ, you can safely ignore this email."
    )
  );
}

/**
 * Remind a vendor contact that their quote on an open RFQ is still awaited.
 * Sent by the daily reminder cron every 3 days until the vendor responds or the
 * RFQ closes. Same deep link and contract as `sendRfqIssuedEmail`.
 */
export async function sendRfqReminderEmail(
  email: string,
  args: {
    contactName: string;
    projectName: string;
    rfqNumber: string;
    rfqTitle: string;
    responseDeadline: string | null;
    deepLink: string;
    /** 1 for the first reminder, 2 for the second, … — drives the wording. */
    reminderNumber: number;
  }
) {
  const safeContact = escapeHtml(args.contactName);
  const safeProject = escapeHtml(args.projectName);
  const deadline = args.responseDeadline
    ? `Response due by <strong style="color: ${colors.white};">${escapeHtml(args.responseDeadline)}</strong>.`
    : "";
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} | Reminder: RFQ ${escapeHtml(args.rfqNumber)}`,
    emailLayout(
      "Quote Reminder",
      `${bodyText(`Hi ${safeContact}, a quick reminder — your quotation for the RFQ on <strong style="color: ${colors.white};">${safeProject}</strong> is still awaited.`)}
      <div style="text-align: center; margin: 0 0 24px;">
        ${orgPill(`${args.rfqNumber} — ${args.rfqTitle}`)}
      </div>
      ${deadline ? bodyText(deadline) : ""}
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(args.deepLink, "View RFQ")}
      </div>
      ${hintText("Open the link to review the scope and submit your quote. If you've already responded, please ignore this reminder.")}`,
      "If you weren't expecting this RFQ, you can safely ignore this email."
    )
  );
}

/**
 * Notify studio (RFQ creator / PMs on the project) that a vendor has just
 * submitted (or revised) a quote. Deep link lands on the architect's
 * RFQ detail page where they can view it inline and open the comparison.
 */
export async function sendQuoteReceivedEmail(
  email: string,
  args: {
    recipientName: string;
    vendorName: string;
    projectName: string;
    rfqNumber: string;
    rfqTitle: string;
    isRevision: boolean;
    isLate: boolean;
    deepLink: string;
  }
) {
  const safeRecipient = escapeHtml(args.recipientName);
  const safeVendor = escapeHtml(args.vendorName);
  const safeProject = escapeHtml(args.projectName);
  const verb = args.isRevision ? "revised their" : "submitted a";
  const lateBadge = args.isLate
    ? `<div style="text-align: center; margin: 0 0 16px;">${orgPill("Late submission")}</div>`
    : "";
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} | Quote received on ${escapeHtml(args.rfqNumber)}`,
    emailLayout(
      args.isRevision ? "Quote Revised" : "Quote Received",
      `${bodyText(`Hi ${safeRecipient}, <strong style="color: ${colors.white};">${safeVendor}</strong> has ${verb} quote on <strong style="color: ${colors.white};">${safeProject}</strong>.`)}
      <div style="text-align: center; margin: 0 0 24px;">
        ${orgPill(`${args.rfqNumber} — ${args.rfqTitle}`)}
      </div>
      ${lateBadge}
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(args.deepLink, "View RFQ")}
      </div>
      ${hintText("Open the link to review the quote and compare with others.")}`,
      "You're receiving this because you created or own this RFQ."
    )
  );
}

/**
 * Notify the winning vendor that their quote has been awarded. Deep link
 * lands on the vendor portal's RFQ detail page so they can see the award
 * confirmation alongside the original scope.
 */
export async function sendQuoteAwardedEmail(
  email: string,
  args: {
    contactName: string;
    vendorName: string;
    projectName: string;
    rfqNumber: string;
    rfqTitle: string;
    deepLink: string;
  }
) {
  const safeContact = escapeHtml(args.contactName);
  const safeProject = escapeHtml(args.projectName);
  await sendEmail(
    email,
    `${getEnvTag()}${branding.appName} | Quote awarded on ${escapeHtml(args.rfqNumber)}`,
    emailLayout(
      "Quote Awarded",
      `${bodyText(`Hi ${safeContact}, your quote on <strong style="color: ${colors.white};">${safeProject}</strong> has been awarded.`)}
      <div style="text-align: center; margin: 0 0 24px;">
        ${orgPill(`${args.rfqNumber} — ${args.rfqTitle}`)}
      </div>
      ${divider()}
      <div style="padding-top: 24px;">
        ${ctaButton(args.deepLink, "View RFQ")}
      </div>
      ${hintText("You'll receive a purchase order once the studio finalises the paperwork.")}`,
      "Congratulations — and thank you for quoting."
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
  const safeName = escapeHtml(name);
  await sendEmail(
    newEmail,
    `${getEnvTag()}${branding.appName} | Confirm Your New Email`,
    emailLayout(
      "Confirm Your New Email",
      `${bodyText(`Hi ${safeName}, you requested to change your email address to this one. Click the button below to confirm.`)}
      ${warningBox("You'll need to enter your account password to complete the change")}
      <div style="padding-top: 16px;">
        ${divider()}
      </div>
      <div style="padding-top: 24px;">
        ${ctaButton(url, "Confirm New Email")}
      </div>
      ${hintText("This link expires in 24 hours.")}`,
      "If you didn't request this, you can safely ignore this email."
    ),
    { critical: true }
  );
}
