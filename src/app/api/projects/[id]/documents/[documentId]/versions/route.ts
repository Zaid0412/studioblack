import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  createDocumentVersion,
  getDocumentVersionHistory,
  isStoragePathInUse,
} from "@/lib/queries";
import { createDocumentSchema, parseRequest } from "@/lib/validations";

/**
 * GET /api/projects/[id]/documents/[documentId]/versions
 *
 * Returns every row in the document's version group oldest-first — matches
 * the timeline render order in the detail sheet.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const { id, documentId } = params;
    const rows = await getDocumentVersionHistory(documentId, id);
    if (!rows) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rows);
  }
);

/**
 * POST /api/projects/[id]/documents/[documentId]/versions
 *
 * Registers a new version row AFTER the bytes have been PUT to the signed
 * URL minted by `./upload-url`. Section is inherited from the current
 * latest row. PM / architect only.
 */
export const POST = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user }, params) => {
    const { id, documentId } = params;
    const parsed = await parseRequest(req, createDocumentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const expectedPrefix = `projects/${id}/documents/`;
    if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "storagePath does not belong to this project" },
        { status: 400 }
      );
    }
    if (await isStoragePathInUse(parsed.data.storagePath, id)) {
      return NextResponse.json(
        { error: "storagePath is already registered" },
        { status: 409 }
      );
    }
    const row = await createDocumentVersion({
      projectId: id,
      documentId,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      mimeType: parsed.data.mimeType,
      storagePath: parsed.data.storagePath,
      uploadedBy: user.id,
      description: parsed.data.description ?? null,
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(row, { status: 201 });
  }
);
