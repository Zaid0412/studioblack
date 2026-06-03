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

/**
 * Studio-internal users (PM + architect) — the inverse of `isExternalViewer`
 * for a known role. Use for client-side "can see internal surfaces" gates
 * (e.g. the Order/procurement step) so the studio↔external boundary has one
 * definition instead of an inline `role === "pm" || role === "architect"`.
 */
export function isStudioUser(role: UserRole | null | undefined): boolean {
  return role === "pm" || role === "architect";
}

/**
 * Boolean flags used by the BOQ phase-permission matrix and other route
 * guards. Derived from the better-auth `orgRole` (owner/admin/member) plus
 * the app's `effectiveRole` (which folds in client/vendor from `dbRole`).
 *
 * Single source of truth — route handlers and any other server-side gate
 * should call this rather than re-deriving `isPM = orgRole === "owner"
 * || orgRole === "admin"` inline.
 */
export function deriveRoleFlags(
  orgRole: string | null | undefined,
  effectiveRole: UserRole | null | undefined
): { isPM: boolean; isArchitect: boolean; isClient: boolean } {
  return {
    isPM: orgRole === "owner" || orgRole === "admin",
    isArchitect: orgRole === "member",
    isClient: effectiveRole === "client",
  };
}

/**
 * Map a better-auth `member.role` (owner/admin/member) onto the app's
 * `UserRole`. Anyone outside the org (no row) falls back to "pm" — used
 * by read-only historical surfaces (e.g. the BOQ item activity timeline)
 * where it's better to over-attribute than to fail rendering.
 */
export function memberRoleToUserRole(
  memberRole: string | null | undefined
): UserRole {
  if (memberRole === "owner" || memberRole === "admin") return "pm";
  if (memberRole === "member") return "architect";
  return "pm";
}
