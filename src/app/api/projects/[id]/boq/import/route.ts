import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  getBoqByProject,
  getBoqStatus,
  getElementsByCodeMap,
} from "@/lib/queries";
import { parseBoqSheet } from "@/lib/excel/boqParser";
import { BOQ_IMPORT_MAX_BYTES } from "@/lib/validations";

const ALLOWED_EXTENSIONS = [".xlsx"];
const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
];

/** ZIP local-file-header magic ("PK\x03\x04") — xlsx is a zip archive. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

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

    const status = await getBoqStatus(boq.id, params.id);
    if (status === "locked" || status === "superseded") {
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

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const name = file.name?.toLowerCase() ?? "";
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const hasValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type);
    if (!hasValidExt || !hasValidMime) {
      return NextResponse.json(
        { error: "File must be an .xlsx spreadsheet" },
        { status: 400 }
      );
    }

    if (file.size > BOQ_IMPORT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${BOQ_IMPORT_MAX_BYTES / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic-byte check — MIME/extension are both client-controlled, so a
    // renamed zip bomb or arbitrary file would otherwise reach ExcelJS.
    if (
      buffer.length < ZIP_MAGIC.length ||
      !buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)
    ) {
      return NextResponse.json(
        { error: "File must be an .xlsx spreadsheet" },
        { status: 400 }
      );
    }

    const elementsByCode = await getElementsByCodeMap(orgId);

    try {
      const result = await parseBoqSheet(buffer, elementsByCode);
      return NextResponse.json({ ...result, boqId: boq.id });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not read spreadsheet";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
