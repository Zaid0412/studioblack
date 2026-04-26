import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  getBoqByProject,
  getBoqForExport,
  getProjectById,
} from "@/lib/queries";
import { writeBoqSheet } from "@/lib/excel/boqWriter";

/**
 * GET /api/projects/[id]/boq/export
 * Streams the project's BOQ as an .xlsx file. Architect view — no client
 * variant here. Columns match the import template so the file round-trips.
 */
export const GET = withAuth(
  {
    blockedRoles: ["client"],
    projectAccess: true,
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (_req, _ctx, params) => {
    const header = await getBoqByProject(params.id);
    if (!header) {
      return NextResponse.json(
        { error: "No BOQ for this project yet" },
        { status: 404 }
      );
    }

    const [boq, project] = await Promise.all([
      getBoqForExport(header.id),
      getProjectById(params.id),
    ]);
    if (!boq) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    const buffer = await writeBoqSheet(boq);

    const stamp = new Date().toISOString().slice(0, 10);
    const projectSlug = project?.name ? slug(project.name) : "project";
    const filename = `${projectSlug}-BOQ-${stamp}.xlsx`;

    const headers = new Headers({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(filename),
      "X-Boq-Item-Count": String(boq.items.length),
    });

    return new NextResponse(new Uint8Array(buffer), { headers });
  }
);

/**
 * RFC 5987 Content-Disposition header: plain ASCII `filename=` fallback plus
 * percent-encoded UTF-8 `filename*=` for non-ASCII names (Turkish etc.).
 */
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project"
  );
}
