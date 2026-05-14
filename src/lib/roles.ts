import type { UserRole } from "@/types";

/**
 * Viewers that must not see studio-internal data (cost, margin, budget,
 * internal notes, etc.). `client` and `vendor` are both external parties
 * who reach project surfaces through their own channels and should only
 * see what the studio explicitly shares.
 *
 * Pure predicate, zero runtime dependencies — safe to import from both
 * server modules and client components. Don't add DB queries or imports
 * from `@/lib/queries` to this file, or `pg` will get bundled into the
 * browser build.
 */
export function isExternalViewer(
  role: UserRole | string | null | undefined
): boolean {
  return role === "client" || role === "vendor";
}
