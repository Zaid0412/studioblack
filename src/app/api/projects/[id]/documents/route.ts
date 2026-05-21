import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { listProjectDocuments } from "@/lib/queries";

/**
 * GET /api/projects/[id]/documents
 *
 * Flat list of every document in the project, joined with section name. Used
 * by the "All documents" view in the Documents page sidebar.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const docs = await listProjectDocuments(params.id);
    return NextResponse.json(docs);
  }
);
