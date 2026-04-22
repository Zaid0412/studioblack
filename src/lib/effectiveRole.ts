import { getMemberRole } from "@/lib/queries";
import type { UserRole } from "@/types";

/**
 * Map a better-auth org membership + DB fallback role to the app's UserRole.
 *
 * Org role → app role:
 *   owner / admin → "pm"
 *   member        → "architect"
 *   client        → "client"
 *
 * If the user's DB role is already "client", that's authoritative and no org
 * lookup happens — a client's user.role must be set in the DB, flipping their
 * org role alone doesn't promote them.
 */
export async function deriveEffectiveRole(
  userId: string,
  orgId: string | null | undefined,
  dbRole: string | null | undefined
): Promise<UserRole> {
  if (dbRole === "client") return "client";
  if (!orgId) return (dbRole as UserRole) ?? "pm";

  const memberRole = await getMemberRole(orgId, userId);
  if (memberRole === "client") return "client";
  if (memberRole === "owner" || memberRole === "admin") return "pm";
  if (memberRole === "member") return "architect";
  return (dbRole as UserRole) ?? "pm";
}
