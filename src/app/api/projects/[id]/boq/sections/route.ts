import { NextResponse } from "next/server";
import { createBoqSection } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createBoqSectionSchema } from "@/lib/validations";
import { parseBoqRequest } from "../_helpers";

export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const result = await parseBoqRequest(
      req,
      params.id,
      createBoqSectionSchema
    );
    if (!result.ok) return result.response;

    const section = await createBoqSection(result.boqId, result.data);
    return NextResponse.json(section, { status: 201 });
  }
);
