import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { bulkUpsertElements } from "@/lib/queries";
import { parseRequest, importConfirmSchema } from "@/lib/validations";

/**
 * POST /api/elements/import/confirm
 * Executes a previously-validated import. The server re-validates every row
 * against importConfirmSchema — we never trust the first-pass parse output.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, importConfirmSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const result = await bulkUpsertElements(orgId, {
        strategy: parsed.data.strategy,
        createdBy: user.id,
        rows: parsed.data.rows,
      });
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
