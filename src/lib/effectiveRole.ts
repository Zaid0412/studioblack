import { getMemberRole } from "@/lib/queries";
import type { UserRole } from "@/types";

// A client's `user.role` is authoritative — flipping their org role alone
// must not promote them to pm/architect, so the DB role check runs first.
/**
 * Resolve the user's effective app role from their DB role + org membership.
 * A client's `user.role` is authoritative — flipping their org role alone
 * must not promote them to pm/architect, so the DB role check runs first.
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
