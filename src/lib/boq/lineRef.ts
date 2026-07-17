/**
 * A BOQ line's business reference: the line's division code joined to its
 * per-division line number, e.g. `PLB-20`. Line numbers restart per division, so
 * the bare number no longer identifies a line within a BOQ — the code prefix
 * does. Falls back to the bare number when a code is somehow absent (a
 * grandfathered row read before the division backfill, or an external-viewer
 * payload that scrubbed it).
 */
export function formatBoqLineRef(
  code: string | null | undefined,
  lineNumber: number
): string {
  const c = code?.trim();
  return c ? `${c}-${lineNumber}` : String(lineNumber);
}
