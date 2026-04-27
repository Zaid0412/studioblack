import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getBoqByProject, getElementsByCodeMap } from "@/lib/queries";
import { parseBoqSheet } from "@/lib/excel/boqParser";
import { validateXlsxUpload } from "@/lib/excel/uploadGuard";
import { BOQ_IMPORT_MAX_BYTES } from "@/lib/validations";

/**
 * POST /api/projects/[id]/boq/import
 * Accepts an .xlsx file, returns a preview ParseResult. No DB writes.
 *
 * Gates: project access, non-client role, rate limit, BOQ status editable.
 */
export const POST = withAuth(
  {
    blockedRoles: ["client"],
    projectAccess: true,
    rateLimit: { limit: 5, windowMs: 60_000 },
  },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const boq = await getBoqByProject(params.id);
    if (!boq) {
      return NextResponse.json(
        { error: "No BOQ for this project yet" },
        { status: 404 }
      );
    }
    // `getBoqByProject` already filters out 'superseded'; check 'locked'
    // here so we don't burn an extra round-trip on `getBoqStatus`.
    if (boq.status === "locked") {
      return NextResponse.json(
        {
          error: "This BOQ is locked and can no longer be edited.",
          code: "BOQ_LOCKED",
        },
        { status: 423 }
      );
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
      BOQ_IMPORT_MAX_BYTES
    );
    if (!upload.ok) {
      return NextResponse.json(
        { error: upload.message },
        { status: upload.status }
      );
    }

    const elementsByCode = await getElementsByCodeMap(orgId);

    try {
      const result = await parseBoqSheet(upload.buffer, elementsByCode);
      return NextResponse.json({ ...result, boqId: boq.id });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not read spreadsheet";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
