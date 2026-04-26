/**
 * Shared cell-coercion primitives for the xlsx parsers (F3 elements, F6 BOQ).
 *
 * Locale heuristics (decimal-comma vs. thousands-separator) live here so a
 * fix lands in every importer. The parsers themselves only handle template
 * shape and per-row validation.
 */

// ── Safety caps ────────────────────────────────────────────────────────────
/** Hard cap on columns scanned per sheet — guards against bombs. */
export const MAX_COLS = 64;

// ── Header normalisation ────────────────────────────────────────────────────

/**
 * Lower-case + collapse whitespace + strip BOM. Used to map header-row
 * labels to internal template keys regardless of casing or trailing space.
 */
export function normalizeHeader(s: string): string {
  return s
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ── Cell coercion ───────────────────────────────────────────────────────────

/**
 * Flatten an exceljs cell value to a primitive. Handles rich text, hyperlinks,
 * formula results, dates, and formula-error cells (`{ error: "#DIV/0!" }`)
 * by returning their display text or an empty string.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/^\uFEFF/, "").trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // ExcelJS formula-error cells. Treat as empty — the parser re-reports
    // the missing value via its required-field check.
    if (typeof v.error === "string") return "";
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((t) =>
          typeof t === "object" && t && "text" in t
            ? (t as { text: string }).text
            : ""
        )
        .join("")
        .trim();
    }
    if (typeof v.hyperlink === "string") {
      return typeof v.text === "string" ? String(v.text).trim() : "";
    }
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result !== "undefined") return cellText(v.result);
  }
  return String(value).trim();
}

export interface CellNumberResult {
  value: number | null;
  /**
   * True when the text-path decimal heuristic fired on a 3-trailing-digit
   * single-comma input (e.g. `"1,234"`). The value is returned as a decimal
   * (1.234) per the Turkey-market default; the caller surfaces a row-level
   * warning so the user can sanity-check the parse.
   */
  ambiguous: boolean;
}

/**
 * Parse a cell value to a number, with locale heuristics for TR/EU decimal
 * formatting. Excel-sourced numbers hit the `typeof number` fast-path; only
 * text-typed cells exercise the locale branch.
 *
 * Rules (text path):
 *   - `"1.234,56"` → `1234.56` (comma is decimal when it appears last)
 *   - `"1,234.56"` → `1234.56` (dot is decimal when it appears last)
 *   - `"1,5"`     → `1.5` (single comma, 1–3 trailing digits → decimal)
 *   - `"1,234"`   → `1.234` (ambiguous; flagged via `ambiguous: true`)
 */
export function cellNumber(value: unknown): CellNumberResult {
  if (value === null || value === undefined || value === "")
    return { value: null, ambiguous: false };
  if (typeof value === "number" && Number.isFinite(value))
    return { value, ambiguous: false };
  const text = cellText(value);
  if (text === "") return { value: null, ambiguous: false };

  const cleaned = text.replace(/\s/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;
  let ambiguous = false;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    const onlyOneComma = parts.length === 2;
    const trailing = onlyOneComma ? parts[1] : "";
    const leading = onlyOneComma ? parts[0] : "";
    const looksDecimal =
      onlyOneComma && /^\d{1,3}$/.test(trailing) && /^-?\d+$/.test(leading);
    if (looksDecimal) {
      normalized = `${leading}.${trailing}`;
      // "1,234" could be thousands-separator (1234) or decimal (1.234);
      // flag so the caller can ask the user to confirm.
      if (trailing.length === 3) ambiguous = true;
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const n = Number(normalized);
  return { value: Number.isFinite(n) ? n : null, ambiguous };
}

/**
 * Coerce a cell to a tristate boolean. Accepts true/false/yes/no/y/n/1/0
 * (case-insensitive). Returns undefined for empty/unknown — caller decides
 * if that's an error.
 */
export function cellBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const text = cellText(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return undefined;
}
