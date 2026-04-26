/**
 * Validate an uploaded xlsx file before reading it. Performs:
 *   1. Filename extension check (.xlsx)
 *   2. MIME allow-list (with the older `application/vnd.ms-excel` and
 *      `application/octet-stream` aliases some clients send)
 *   3. Byte-size cap
 *   4. Magic-byte check — extension and MIME are both client-controlled,
 *      so a renamed zip bomb or arbitrary file would otherwise reach
 *      ExcelJS. Real .xlsx files are zip archives starting `PK\x03\x04`.
 *
 * Used by both element-import and BOQ-import POST handlers. Centralising
 * keeps the magic bytes, MIME list, and size errors in one place.
 */

const ALLOWED_EXTENSIONS = [".xlsx"];
const ALLOWED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
];

/** ZIP local-file-header magic ("PK\x03\x04") — xlsx is a zip archive. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const INVALID_FILE_MESSAGE = "File must be an .xlsx spreadsheet";

export type ValidateXlsxResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; status: number; message: string };

/**
 * Pull the file out of `formData`, run the guard, and return either a parsed
 * buffer or a `{ status, message }` payload the caller forwards to the
 * client as `NextResponse.json({ error: message }, { status })`.
 */
export async function validateXlsxUpload(
  formData: FormData,
  field: string,
  maxBytes: number
): Promise<ValidateXlsxResult> {
  const file = formData.get(field);
  if (!file || typeof file === "string") {
    return { ok: false, status: 400, message: "No file provided" };
  }

  const name = file.name?.toLowerCase() ?? "";
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasValidMime = !file.type || ALLOWED_MIME_TYPES.includes(file.type);
  if (!hasValidExt || !hasValidMime) {
    return { ok: false, status: 400, message: INVALID_FILE_MESSAGE };
  }

  if (file.size > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `File exceeds ${maxBytes / 1024 / 1024}MB`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (
    buffer.length < ZIP_MAGIC.length ||
    !buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)
  ) {
    return { ok: false, status: 400, message: INVALID_FILE_MESSAGE };
  }

  return { ok: true, buffer };
}
