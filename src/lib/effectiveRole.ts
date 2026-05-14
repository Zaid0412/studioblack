import { getMemberRole } from "@/lib/queries";
import type { UserRole } from "@/types";

/**
 * Resolve the user's effective app role from their DB role + org membership.
 *
 * The DB role is authoritative for `client` and `vendor` — flipping their
 * org role alone must not promote them to pm/architect, so the DB role
 * check runs first.
 */
export async function deriveEffectiveRole(
  userId: string,
  orgId: string | null | undefined,
  dbRole: string | null | undefined
): Promise<UserRole> {
  if (dbRole === "client") return "client";
  if (dbRole === "vendor") return "vendor";
  if (!orgId) return (dbRole as UserRole) ?? "pm";

  const memberRole = await getMemberRole(orgId, userId);
  if (memberRole === "client") return "client";
  if (memberRole === "vendor") return "vendor";
  if (memberRole === "owner" || memberRole === "admin") return "pm";
  if (memberRole === "member") return "architect";
  return (dbRole as UserRole) ?? "pm";
}
