import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  memberAc,
} from "better-auth/plugins/organization/access";

/**
 * Access-control statements for the organisation plugin.
 *
 * Extends the built-in statements with a `project` resource so we can
 * gate project-level actions per role later.
 */
const statements = {
  ...defaultStatements,
  project: ["create", "update", "delete", "share"],
} as const;

export const ac = createAccessControl(statements);

/**
 * PM — project manager who created the org. Full access (implicit in better-auth,
 *      but we define it explicitly for consistency).
 */
export const owner = ac.newRole({
  project: ["create", "update", "delete", "share"],
  ...adminAc.statements,
});

/**
 * admin — additional PMs invited later. Same project access as owner,
 *         inherits default admin permissions for org management.
 */
export const admin = ac.newRole({
  project: ["create", "update", "delete", "share"],
  ...adminAc.statements,
});

/**
 * member — Architects. Can work on designs/tasks within a project but cannot
 *          edit, create, or delete the project itself. Project edits are
 *          PM-only (org admins/owners, or architects promoted via
 *          `project_member.role='pm'`).
 */
export const member = ac.newRole({
  project: [],
  ...memberAc.statements,
});

/**
 * client — External clients invited to the org. No project or org
 *          management permissions. Access is controlled via client_email
 *          on individual projects.
 */
export const client = ac.newRole({
  project: [],
  organization: [],
  member: [],
  invitation: [],
});

/**
 * vendor — External suppliers invited via vendor_contact. No project or
 *          org management permissions. Access is scoped to their own
 *          vendor record (and downstream RFQs/POs in F9/F14).
 */
export const vendor = ac.newRole({
  project: [],
  organization: [],
  member: [],
  invitation: [],
});
