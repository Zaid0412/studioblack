/**
 * Validate an uploaded spreadsheet before reading it. Performs:
 *   1. Filename extension check (.xlsx, and .csv where the caller allows it)
 *   2. MIME allow-list (with the older `application/vnd.ms-excel` and
 *      `application/octet-stream` aliases some clients send)
 *   3. Byte-size cap
 *   4. Magic-byte check — extension and MIME are both client-controlled,
 *      so a renamed zip bomb or arbitrary file would otherwise reach
 *      ExcelJS. Real .xlsx files are zip archives starting `PK\x03\x04`.
 *
 * Used by the element, BOQ and category import POST handlers. Centralising
 * keeps the magic bytes, MIME list, and size errors in one place.
 */

const XLSX_EXTENSION = ".xlsx";
const CSV_EXTENSION = ".csv";

const XLSX_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
];

/**
 * Browsers disagree wildly about CSV: Chrome sends `text/csv`, Excel on Windows
 * registers the file as `application/vnd.ms-excel`, and one dragged out of a
 * text editor arrives as `text/plain` or with no type at all.
 */
const CSV_MIME_TYPES = [
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/octet-stream",
];

/** ZIP local-file-header magic ("PK\x03\x04") — xlsx is a zip archive. */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export type SpreadsheetFormat = "xlsx" | "csv";

export type ValidateUploadResult =
  | { ok: true; buffer: Buffer; format: SpreadsheetFormat }
  | { ok: false; status: number; message: string };

const isZip = (buffer: Buffer) =>
  buffer.length >= ZIP_MAGIC.length &&
  buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC);

/**
 * Read the upload from a `Request`, run the guard, and return either a parsed
 * buffer plus its format, or a `{ status, message }` payload the caller
 * forwards as `NextResponse.json({ error: message }, { status })`.
 *
 * Centralising the `formData()` parse means `Invalid form data` errors are
 * mapped to a 400 in one place.
 */
export async function validateSpreadsheetUpload(
  req: Request,
  field: string,
  maxBytes: number,
  { allowCsv = false }: { allowCsv?: boolean } = {}
): Promise<ValidateUploadResult> {
  const invalidMessage = allowCsv
    ? "File must be an .xlsx or .csv spreadsheet"
    : "File must be an .xlsx spreadsheet";

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return { ok: false, status: 400, message: "Invalid form data" };
  }

  const file = formData.get(field);
  if (!file || typeof file === "string") {
    return { ok: false, status: 400, message: "No file provided" };
  }

  const name = file.name?.toLowerCase() ?? "";
  const format: SpreadsheetFormat | null = name.endsWith(XLSX_EXTENSION)
    ? "xlsx"
    : allowCsv && name.endsWith(CSV_EXTENSION)
      ? "csv"
      : null;
  if (!format) {
    return { ok: false, status: 400, message: invalidMessage };
  }

  const allowedMimes = format === "csv" ? CSV_MIME_TYPES : XLSX_MIME_TYPES;
  if (file.type && !allowedMimes.includes(file.type)) {
    return { ok: false, status: 400, message: invalidMessage };
  }

  if (file.size > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `File exceeds ${maxBytes / 1024 / 1024}MB`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // The extension is a claim, not evidence. An xlsx must really be a zip — and
  // a .csv must really NOT be one, or a renamed workbook reaches the CSV reader,
  // which would read its raw zip bytes as text and yield garbage rows.
  if (format === "xlsx" ? !isZip(buffer) : isZip(buffer)) {
    return { ok: false, status: 400, message: invalidMessage };
  }

  return { ok: true, buffer, format };
}

/** The xlsx-only callers (element + BOQ imports). */
export async function validateXlsxUpload(
  req: Request,
  field: string,
  maxBytes: number
): Promise<ValidateUploadResult> {
  return validateSpreadsheetUpload(req, field, maxBytes);
}
