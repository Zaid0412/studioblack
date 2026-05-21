import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { listDocumentSections, createDocumentSection } from "@/lib/queries";
import { createDocumentSectionSchema, parseRequest } from "@/lib/validations";

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
    const section = await createDocumentSection({
      projectId: params.id,
      name: parsed.data.name,
      icon: parsed.data.icon ?? "Folder",
      createdBy: user.id,
    });
    return NextResponse.json(section, { status: 201 });
  }
);
