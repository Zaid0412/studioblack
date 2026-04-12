import { NextResponse } from "next/server";
import { setAttachmentFreezeStatus } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** Shared handler for freeze/unfreeze routes — only the boolean differs. */
export function createFreezeHandler(freeze: boolean) {
  return withAuth(
    {
      allowedRoles: ["pm"],
      projectAccess: true,
      rateLimit: { limit: 10, windowMs: 60_000 },
    },
    async (_req, _ctx, params) => {
      const { error, data } = await setAttachmentFreezeStatus(
        params.attachmentId,
        params.id,
        freeze
      );

      if (error === "not_found") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const alreadyError = freeze ? "already_frozen" : "already_unfrozen";
      const alreadyMsg = freeze ? "Already frozen" : "Already unfrozen";
      if (error === alreadyError) {
        return NextResponse.json({ error: alreadyMsg }, { status: 400 });
      }

      return NextResponse.json(data);
    }
  );
}
