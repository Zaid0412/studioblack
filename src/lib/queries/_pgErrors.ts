/**
 * Map a pg error to a user-facing message. Raw `err.message` from pg can
 * leak constraint names, SQL snippets, and column identifiers that mean
 * nothing to an end user (and edge into info disclosure).
 *
 * The `IMPORT_PG_DEBUG` env flag appends the raw text in non-production
 * environments — explicitly fail-closed in production even if the flag is
 * accidentally set, so a deploy-script copy-paste can't undo this guard.
 *
 * Used by both element (F3) and BOQ (F6) bulk import paths.
 */
const IMPORT_PG_DEBUG =
  process.env.IMPORT_PG_DEBUG === "1" && process.env.NODE_ENV !== "production";

export interface PgErrorLike {
  code?: string;
  message?: string;
}

export function mapPgError(err: PgErrorLike): string {
  const suffix = IMPORT_PG_DEBUG && err.message ? ` [${err.message}]` : "";
  switch (err.code) {
    case "23505":
      return `Duplicate key — another row with this code already exists${suffix}`;
    case "23503":
      return `Referenced record not found (foreign key)${suffix}`;
    case "23514":
      return `Value failed a database check constraint${suffix}`;
    case "23502":
      return `Required field is missing${suffix}`;
    default:
      return `Database error${err.code ? ` (${err.code})` : ""}${suffix}`;
  }
}
