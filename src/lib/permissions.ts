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
 * owner — PM who created the org. Full access (implicit in better-auth,
 *          but we define it explicitly for consistency).
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
 * member — Architects. Can update projects/designs but not create or
 *          delete them. Only PMs (owner/admin) can create projects.
 */
export const member = ac.newRole({
  project: ["update"],
  ...memberAc.statements,
});
