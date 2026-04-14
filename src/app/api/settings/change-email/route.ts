import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { parseRequest } from "@/lib/validations";
import { z } from "zod";
import { createPendingEmailChange, isEmailTaken } from "@/lib/queries";
import { sendChangeEmailVerification } from "@/lib/email";

const changeEmailSchema = z.object({
  newEmail: z.string().email(),
});

export const POST = withAuth(
  { rateLimit: { limit: 5, windowMs: 600_000 } },
  async (req, { user }) => {
    const parsed = await parseRequest(req, changeEmailSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { newEmail } = parsed.data;
    const normalizedNew = newEmail.toLowerCase().trim();
    const normalizedCurrent = user.email.toLowerCase().trim();

    if (normalizedNew === normalizedCurrent) {
      return NextResponse.json(
        { error: "New email must be different from current email" },
        { status: 400 }
      );
    }

    const taken = await isEmailTaken(normalizedNew);
    if (taken) {
      return NextResponse.json(
        { error: "This email is already in use" },
        { status: 409 }
      );
    }

    const { token } = await createPendingEmailChange(user.id, normalizedNew);

    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl = `${proto}://${host}`;
    const verifyUrl = `${baseUrl}/verify-email-change?token=${token}`;

    await sendChangeEmailVerification(
      normalizedNew,
      user.name || "there",
      verifyUrl
    );

    return NextResponse.json({ sent: true });
  }
);
