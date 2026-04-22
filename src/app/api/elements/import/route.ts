import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getCategoryTree } from "@/lib/queries";
import { parseElementSheet } from "@/lib/excel/elementParser";
import { ELEMENT_IMPORT_MAX_BYTES } from "@/lib/validations";

const ALLOWED_EXTENSIONS = [".xlsx"];
const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", // older clients occasionally send this for .xlsx
  "application/octet-stream",
];

/** ZIP local-file-header magic ("PK\x03\x04") — xlsx is a zip archive. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

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

    if (file.size > ELEMENT_IMPORT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${ELEMENT_IMPORT_MAX_BYTES / 1024 / 1024}MB` },
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

    const categories = await getCategoryTree(orgId);

    try {
      const result = await parseElementSheet(buffer, categories);
      return NextResponse.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not read spreadsheet";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }
);
