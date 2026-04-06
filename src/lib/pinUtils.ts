import type { DbPinComment } from "@/types";

/** Sort pins by created_at ascending. */
export function sortPinsByDate(pins: DbPinComment[]): DbPinComment[] {
  return [...pins].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Whether a pin has coordinates (is placed on the document). */
export function isPinned(p: DbPinComment): boolean {
  return p.x_percent !== null && p.y_percent !== null && p.page !== null;
}

/** Build a 1-based index map for pinned comments, ordered by created_at. */
export function buildPinIndexMap(pins: DbPinComment[]): Map<string, number> {
  const pinned = sortPinsByDate(pins.filter(isPinned));
  return new Map(pinned.map((p, i) => [p.id, i + 1]));
}
