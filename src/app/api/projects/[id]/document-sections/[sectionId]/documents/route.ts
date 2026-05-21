import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  getDocumentSectionById,
  listSectionDocuments,
  createDocument,
} from "@/lib/queries";
import { createDocumentSchema, parseRequest } from "@/lib/validations";

/** GET /api/projects/[id]/document-sections/[sectionId]/documents */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const { id, sectionId } = params;
    const section = await getDocumentSectionById(sectionId, id);
    if (!section) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const docs = await listSectionDocuments(sectionId, id);
    return NextResponse.json(docs);
  }
);

/**
 * POST /api/projects/[id]/document-sections/[sectionId]/documents
 *
 * Registers a document AFTER the client has PUT the bytes to the signed
 * upload URL (see ./upload-url/route.ts). PM / architect only — clients
 * are read-only on documents.
 */
export const POST = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user }, params) => {
    const { id, sectionId } = params;
    const section = await getDocumentSectionById(sectionId, id);
    if (!section) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = await parseRequest(req, createDocumentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    // The storage path was issued by upload-url for this project. Refuse any
    // payload that didn't come from that flow — otherwise a user could register
    // an arbitrary key in the bucket.
    const expectedPrefix = `projects/${id}/documents/`;
    if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "storagePath does not belong to this project" },
        { status: 400 }
      );
    }
    const doc = await createDocument({
      projectId: id,
      sectionId,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      mimeType: parsed.data.mimeType,
      storagePath: parsed.data.storagePath,
      uploadedBy: user.id,
    });
    return NextResponse.json(doc, { status: 201 });
  }
);
