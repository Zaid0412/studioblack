import type { UserRole } from "@/types";

/**
 * `client` and `vendor` are external parties — never expose studio-internal
 * data (cost, margin, budget, internal notes) to them.
 *
 * Don't add DB or `@/lib/queries` imports to this file or `pg` will get
 * bundled into the browser build.
 */
export function isExternalViewer(role: UserRole | null | undefined): boolean {
  return role === "client" || role === "vendor";
}
