import { getMemberRole, isProjectPm } from "@/lib/queries";
import type { UserRole } from "@/types";

/**
 * Resolve the user's effective app role from their DB role + org membership.
 *
 * The DB role is authoritative for `client` and `vendor` — flipping their
 * org role alone must not promote them to pm/architect, so the DB role
 * check runs first.
 *
 * `projectId` (optional): when provided, an architect (org "member") who has
 * been assigned as PM on that specific project via `project_member.role='pm'`
 * is treated as `"pm"` for this request. Org owners/admins are always PM
 * regardless of project context.
 */
export async function deriveEffectiveRole(
  userId: string,
  orgId: string | null | undefined,
  dbRole: string | null | undefined,
  projectId?: string | null
): Promise<UserRole> {
  if (dbRole === "client") return "client";
  if (dbRole === "vendor") return "vendor";
  if (!orgId) return (dbRole as UserRole) ?? "pm";

  const memberRole = await getMemberRole(orgId, userId);
  if (memberRole === "client") return "client";
  if (memberRole === "vendor") return "vendor";
  if (memberRole === "owner" || memberRole === "admin") return "pm";
  if (memberRole === "member") {
    // Architects can be project-scoped PMs. Only run the extra query when we
    // have a projectId — global routes don't need (and shouldn't pay for) it.
    if (projectId && (await isProjectPm(projectId, userId))) return "pm";
    return "architect";
  }
  return (dbRole as UserRole) ?? "pm";
}
