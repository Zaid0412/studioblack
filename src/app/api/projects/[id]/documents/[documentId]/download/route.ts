import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getDocumentById } from "@/lib/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";

const SIGNED_URL_TTL_SECONDS = 60 * 5;

/**
 * GET /api/projects/[id]/documents/[documentId]/download
 *
 * Returns a short-lived (5 min) signed URL the client can use to GET the
 * file directly from Supabase. Clients are allowed because they're viewers.
 */
export const GET = withAuth(
  { projectAccess: true, rateLimit: { limit: 120, windowMs: 60_000 } },
  async (_req, _ctx, params) => {
    const { id, documentId } = params;
    const doc = await getDocumentById(documentId, id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(BUCKETS.documents)
      .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, {
        download: doc.file_name,
      });
    if (error || !data) {
      logger.error("document createSignedUrl failed", {
        documentId,
        error,
      });
      return NextResponse.json(
        { error: "Could not generate download URL" },
        { status: 500 }
      );
    }
    return NextResponse.json({ url: data.signedUrl });
  }
);
