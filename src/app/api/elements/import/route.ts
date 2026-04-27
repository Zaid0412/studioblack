import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getCategoryTree } from "@/lib/queries";
import { parseElementSheet } from "@/lib/excel/elementParser";
import { validateXlsxUpload } from "@/lib/excel/uploadGuard";
import { ELEMENT_IMPORT_MAX_BYTES } from "@/lib/validations";

/**
 * POST /api/elements/import
 * Accepts an .xlsx file, parses it against the template, returns a
 * ParseResult the client renders as a preview table. No DB writes.
 */
export const POST = withAuth(
  {
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 5, windowMs: 60_000 },
  },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const upload = await validateXlsxUpload(
      formData,
      "file",
      ELEMENT_IMPORT_MAX_BYTES
    );
    if (!upload.ok) {
      return NextResponse.json(
        { error: upload.message },
        { status: upload.status }
      );
    }

    const categories = await getCategoryTree(orgId);

    try {
      const result = await parseElementSheet(upload.buffer, categories);
      return NextResponse.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not read spreadsheet";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
