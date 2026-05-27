import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getDocumentById } from "@/lib/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4;

/**
 * GET /api/projects/[id]/documents/[documentId]/download
 *
 * Returns a signed URL (4 hour TTL) the client can use to GET the file
 * directly from Supabase. Clients (viewers) are allowed.
 *
 * The TTL covers the realistic worst case (a workday with the detail sheet
 * left open). Auto-refreshing the URL mid-session would swap the iframe
 * `src` and reload an in-progress PDF reader — we'd rather have the user
 * close + reopen on the extremely rare >4h case than reload on every
 * cadence. Action toolbar buttons mint a fresh URL on click via
 * `refreshUrl`, so they don't depend on this TTL.
 *
 * Intentionally NOT minted with `{ download: fileName }` — that would set
 * `Content-Disposition: attachment` and force every consumer (inline
 * `<img>`/`<iframe>`, "open in new tab") to download instead of view.
 * The `download` action in `FilePreview` appends `?download=...` to this
 * URL client-side, so the disposition only applies to that one action.
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
      .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
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
