import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Unmock @/lib/email so we test the real implementation ────────────────────

vi.unmock("@/lib/email");

// ── Mock: nodemailer (must be before email.ts import) ────────────────────────

const mockSendMail = vi.fn().mockResolvedValue(undefined);
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

import {
  escapeHtml,
  sendMagicLinkEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendInvitationEmail,
  sendChangeEmailVerification,
} from "@/lib/email";

// ── Helpers ──────────────────────────────────────────────────────────────────

function lastSentEmail(): { to: string; subject: string; html: string } {
  expect(mockSendMail).toHaveBeenCalled();
  return mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0];
}

// ── escapeHtml ───────────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;"
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("handles all special chars together", () => {
    expect(escapeHtml(`<a href="x" title='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#039;y&#039;&gt;&amp;"
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns safe string unchanged", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });
});

// ── sendMagicLinkEmail ───────────────────────────────────────────────────────

describe("sendMagicLinkEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends to correct recipient with magic link URL", async () => {
    await sendMagicLinkEmail(
      "client@test.com",
      "https://app.test/magic?token=abc"
    );
    const email = lastSentEmail();

    expect(email.to).toBe("client@test.com");
    expect(email.subject).toContain("Access Your Project");
    expect(email.html).toContain("https://app.test/magic?token=abc");
    expect(email.html).toContain("View Project");
  });

  it("includes expiry warning", async () => {
    await sendMagicLinkEmail("x@test.com", "https://link");
    const email = lastSentEmail();

    expect(email.html).toContain("expires in 15 minutes");
  });
});

// ── sendNotificationEmail ────────────────────────────────────────────────────

describe("sendNotificationEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends with custom subject and body", async () => {
    await sendNotificationEmail(
      "user@test.com",
      "New Review",
      "<p>Your design was reviewed.</p>"
    );
    const email = lastSentEmail();

    expect(email.to).toBe("user@test.com");
    expect(email.subject).toContain("New Review");
    expect(email.html).toContain("Your design was reviewed.");
  });

  it("includes staging tag in non-production", async () => {
    await sendNotificationEmail("x@test.com", "Test", "body");
    const email = lastSentEmail();

    expect(email.subject).toContain("[STAGING]");
  });
});

// ── sendPasswordResetEmail ───────────────────────────────────────────────────

describe("sendPasswordResetEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends reset link to recipient", async () => {
    await sendPasswordResetEmail(
      "user@test.com",
      "https://app.test/reset?token=xyz"
    );
    const email = lastSentEmail();

    expect(email.to).toBe("user@test.com");
    expect(email.subject).toContain("Reset Your Password");
    expect(email.html).toContain("https://app.test/reset?token=xyz");
    expect(email.html).toContain("Reset Password");
  });

  it("includes expiry warning", async () => {
    await sendPasswordResetEmail("x@test.com", "https://link");
    const email = lastSentEmail();

    expect(email.html).toContain("expires in 1 hour");
  });

  it("includes ignore notice", async () => {
    await sendPasswordResetEmail("x@test.com", "https://link");
    const email = lastSentEmail();

    expect(email.html).toContain("didn't request a password reset");
  });
});

// ── sendVerificationEmail ────────────────────────────────────────────────────

describe("sendVerificationEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends verification link with user name", async () => {
    await sendVerificationEmail(
      "new@test.com",
      "John",
      "https://app.test/verify?token=abc"
    );
    const email = lastSentEmail();

    expect(email.to).toBe("new@test.com");
    expect(email.subject).toContain("Verify Your Email");
    expect(email.html).toContain("https://app.test/verify?token=abc");
    expect(email.html).toContain("John");
    expect(email.html).toContain("Verify Email Address");
  });

  it("escapes user name in HTML", async () => {
    await sendVerificationEmail(
      "x@test.com",
      '<script>alert("xss")</script>',
      "https://link"
    );
    const email = lastSentEmail();

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("includes expiry warning", async () => {
    await sendVerificationEmail("x@test.com", "Test", "https://link");
    const email = lastSentEmail();

    expect(email.html).toContain("expires in 24 hours");
  });
});

// ── sendInvitationEmail ──────────────────────────────────────────────────────

describe("sendInvitationEmail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends invitation with inviter name and org name", async () => {
    await sendInvitationEmail(
      "arch@test.com",
      "Sarah PM",
      "Design Studio",
      "https://app.test/invite?code=xyz"
    );
    const email = lastSentEmail();

    expect(email.to).toBe("arch@test.com");
    expect(email.subject).toContain("invited to Design Studio");
    expect(email.html).toContain("Sarah PM");
    expect(email.html).toContain("Design Studio");
    expect(email.html).toContain("https://app.test/invite?code=xyz");
    expect(email.html).toContain("Accept Invitation");
  });

  it("escapes inviter name and org name", async () => {
    await sendInvitationEmail(
      "x@test.com",
      '<img src=x onerror="alert(1)">',
      "Org<script>",
      "https://link"
    );
    const email = lastSentEmail();

    expect(email.html).not.toContain("<img src=x");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("Org&lt;script&gt;");
  });
});

// ── sendChangeEmailVerification ──────────────────────────────────────────────

describe("sendChangeEmailVerification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends confirmation link to new email", async () => {
    await sendChangeEmailVerification(
      "newemail@test.com",
      "Alice",
      "https://app.test/verify-change?token=abc"
    );
    const email = lastSentEmail();

    expect(email.to).toBe("newemail@test.com");
    expect(email.subject).toContain("Confirm Your New Email");
    expect(email.html).toContain("https://app.test/verify-change?token=abc");
    expect(email.html).toContain("Alice");
    expect(email.html).toContain("Confirm New Email");
  });

  it("includes password warning", async () => {
    await sendChangeEmailVerification("x@test.com", "Test", "https://link");
    const email = lastSentEmail();

    expect(email.html).toContain("account password");
  });

  it("escapes user name", async () => {
    await sendChangeEmailVerification(
      "x@test.com",
      "Bob & <Alice>",
      "https://link"
    );
    const email = lastSentEmail();

    expect(email.html).toContain("Bob &amp; &lt;Alice&gt;");
    expect(email.html).not.toContain("Bob & <Alice>");
  });

  it("includes expiry warning", async () => {
    await sendChangeEmailVerification("x@test.com", "Test", "https://link");
    const email = lastSentEmail();

    expect(email.html).toContain("expires in 24 hours");
  });
});
