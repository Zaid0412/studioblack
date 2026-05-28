import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { listDocumentSections, createDocumentSection } from "@/lib/queries";
import { createDocumentSectionSchema, parseRequest } from "@/lib/validations";

/** Postgres unique_violation. */
function isUniqueNameViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/** GET /api/projects/[id]/document-sections — list (auto-seeds defaults on first visit). */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, { user }, params) => {
    const sections = await listDocumentSections(params.id, user.id);
    return NextResponse.json(sections);
  }
);

/** POST /api/projects/[id]/document-sections — create a new section. PM/architect only. */
export const POST = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user }, params) => {
    const parsed = await parseRequest(req, createDocumentSectionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    try {
      const result = await createDocumentSection({
        projectId: params.id,
        name: parsed.data.name,
        icon: parsed.data.icon ?? "Folder",
        parentId: parsed.data.parentId,
        createdBy: user.id,
      });
      if (result === "parent_not_found") {
        return NextResponse.json(
          { error: "Parent section not found." },
          { status: 400 }
        );
      }
      if (result === "parent_too_deep") {
        return NextResponse.json(
          { error: "Sections can only nest one level deep." },
          { status: 400 }
        );
      }
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      if (isUniqueNameViolation(err)) {
        return NextResponse.json(
          { error: "A section with this name already exists." },
          { status: 409 }
        );
      }
      throw err;
    }
  }
);
