import { NextResponse } from "next/server";
import {
  getProjectById,
  updateProject,
  deleteProject,
  getProjectName,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateProjectSchema } from "@/lib/validations";
import { notifyPmAssignment } from "@/lib/notifications";
import { env } from "@/env";
import { getPool } from "@/lib/db";

/** GET /api/projects/[id] — get project details. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id } = params;

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  }
);

/** PATCH /api/projects/[id] — update project (PM only; Architect/Client: forbidden). */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true, fetchOrgRole: true },
  async (req, { orgRole, effectiveRole, user }, params) => {
    const { id } = params;

    // PM authority gates the entire endpoint. `effectiveRole` already accounts
    // for project-scoped PMs (architects assigned via `project_member.role='pm'`),
    // so architects acting as PM on this project keep edit access. Pure
    // architects without project-PM elevation are rejected.
    const isPM = effectiveRole === "pm";
    if (!isPM) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Reassigning PMs stays strictly with the org owner regardless of
    // project-level authority.
    const isOwner = orgRole === "owner";

    const parsed = await parseRequest(req, updateProjectSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    const allowedFields = [
      "name",
      "client_name",
      "client_email",
      "category",
      "status",
      "deadline",
      "scope",
      "area_sqft",
      "estimation_inr",
      "address",
      "city",
      "state",
    ];

    const fields: Record<string, unknown> = {};
    const bodyRecord = body as Record<string, unknown>;
    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (bodyRecord[camelField] !== undefined) {
        fields[field] = bodyRecord[camelField];
      }
    }

    const hasArchitectUpdate = Array.isArray(body.architectIds);

    // PM membership changes are owner-only. Reject when an admin/architect
    // tries to write pmIds rather than silently dropping the field.
    const pmIdsProvided = Array.isArray(body.pmIds);
    if (pmIdsProvided && !isOwner) {
      return NextResponse.json(
        { error: "Only org owners can change project PMs" },
        { status: 403 }
      );
    }
    if (pmIdsProvided && body.pmIds!.length === 0) {
      return NextResponse.json(
        { error: "A project must have at least one PM" },
        { status: 422 }
      );
    }
    const hasPmUpdate = isOwner && pmIdsProvided;

    if (
      Object.keys(fields).length === 0 &&
      !hasArchitectUpdate &&
      !hasPmUpdate
    ) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Capture the existing PM membership before the sync so we can compute
    // the diff and notify only newly-added users. Done before updateProject
    // — the update is delete-and-reinsert internally.
    let existingPmIds: string[] = [];
    if (hasPmUpdate) {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT user_id FROM project_member WHERE project_id = $1 AND role = 'pm'`,
        [id]
      );
      existingPmIds = rows.map((r: { user_id: string }) => r.user_id);
    }

    const updated = await updateProject(
      id,
      fields,
      hasArchitectUpdate ? body.architectIds : undefined,
      hasPmUpdate ? body.pmIds : undefined
    );

    if (hasPmUpdate) {
      const existing = new Set(existingPmIds);
      const newlyAdded = (body.pmIds ?? []).filter((u) => !existing.has(u));
      if (newlyAdded.length > 0) {
        const projectName = (await getProjectName(id)) ?? "your project";
        const baseUrl = env().NEXT_PUBLIC_APP_URL;
        const projectUrl = `${baseUrl}/projects/${encodeURIComponent(id)}`;
        notifyPmAssignment(id, newlyAdded, projectName, projectUrl, user.id);
      }
    }

    return NextResponse.json(updated);
  }
);

/**
 * DELETE /api/projects/[id] — delete project (PM only).
 *
 * `allowedRoles: ["pm"]` plus `projectAccess: true` is enough: withAuth's role
 * derivation already promotes project-PM architects to "pm" for this request,
 * so they can delete the project they have authority over without holding
 * org-wide admin.
 */
export const DELETE = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const deleted = await deleteProject(id);

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }
);
