import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  getDocumentSectionById,
  updateDocumentSection,
  deleteDocumentSection,
} from "@/lib/queries";
import { updateDocumentSectionSchema, parseRequest } from "@/lib/validations";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";

/** Postgres unique_violation. */
function isUniqueNameViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

/** PATCH /api/projects/[id]/document-sections/[sectionId] — rename / re-icon / reorder. */
export const PATCH = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 60, windowMs: 60_000 },
  },
  async (req, _ctx, params) => {
    const { id, sectionId } = params;
    const existing = await getDocumentSectionById(sectionId, id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = await parseRequest(req, updateDocumentSectionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    try {
      const result = await updateDocumentSection({
        sectionId,
        projectId: id,
        ...parsed.data,
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
      if (result === "reparent_with_children") {
        return NextResponse.json(
          {
            error:
              "Move or delete this section's sub-sections before reparenting it.",
          },
          { status: 409 }
        );
      }
      if (result === "parent_self") {
        return NextResponse.json(
          { error: "A section cannot be its own parent." },
          { status: 400 }
        );
      }
      if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(result);
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

/**
 * DELETE /api/projects/[id]/document-sections/[sectionId]
 *
 * Best-effort deletes the storage objects after the FK cascade drops every
 * doc row. Storage cleanup is logged-and-continue rather than blocking — a
 * failed storage delete leaves orphan files but doesn't lose the user's intent.
 */
export const DELETE = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (_req, _ctx, params) => {
    const { id, sectionId } = params;
    const paths = await deleteDocumentSection(sectionId, id);
    if (paths === null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (paths.length > 0) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.storage
        .from(BUCKETS.documents)
        .remove(paths);
      if (error) {
        logger.error("documents storage cleanup failed", {
          sectionId,
          error: error.message,
        });
      }
    }
    return NextResponse.json({ ok: true });
  }
);
