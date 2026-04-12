import { NextResponse } from "next/server";
import { getProjectById, updateProject, deleteProject } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateProjectSchema } from "@/lib/validations";

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

/** PATCH /api/projects/[id] — update project (PM: everything, Architect: limited, Client: forbidden). */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true, fetchOrgRole: true },
  async (req, { orgRole }, params) => {
    const { id } = params;

    const parsed = await parseRequest(req, updateProjectSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const body = parsed.data;

    // Only owners/admins (PMs) can change project status
    const isPM = orgRole === "owner" || orgRole === "admin";

    // Build dynamic update fields
    const allowedFields = isPM
      ? [
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
        ]
      : ["name"];

    const fields: Record<string, unknown> = {};
    const bodyRecord = body as Record<string, unknown>;
    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (bodyRecord[camelField] !== undefined) {
        fields[field] = bodyRecord[camelField];
      }
    }

    const hasArchitectUpdate = isPM && Array.isArray(body.architectIds);
    if (Object.keys(fields).length === 0 && !hasArchitectUpdate) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const updated = await updateProject(
      id,
      fields,
      hasArchitectUpdate ? body.architectIds : undefined
    );

    return NextResponse.json(updated);
  }
);

/** DELETE /api/projects/[id] — delete project (PM only). */
export const DELETE = withAuth(
  { projectAccess: true, fetchOrgRole: true },
  async (req, { orgRole }, params) => {
    const { id } = params;

    // Only org owners/admins (PMs) can delete projects
    if (!orgRole || (orgRole !== "owner" && orgRole !== "admin")) {
      return NextResponse.json(
        { error: "Only PMs can delete projects" },
        { status: 403 }
      );
    }

    const deleted = await deleteProject(id);

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }
);
