import { NextResponse } from "next/server";
import { seedDefaultDivisions, getDivisions } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * POST /api/divisions/restore — re-seed any missing default divisions.
 * Idempotent: only codes not already present are added.
 */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const added = await seedDefaultDivisions(orgId);
    const divisions = await getDivisions(orgId);
    return NextResponse.json({ added, divisions });
  }
);
