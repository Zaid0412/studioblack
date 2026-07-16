import { NextResponse } from "next/server";
import { createBoqSection, divisionBelongsToOrg } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createBoqSectionSchema } from "@/lib/validations";
import { parseBoqRequest } from "../_helpers";

export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    const result = await parseBoqRequest(
      req,
      params.id,
      createBoqSectionSchema
    );
    if (!result.ok) return result.response;

    if (
      result.data.divisionId &&
      (!orgId || !(await divisionBelongsToOrg(result.data.divisionId, orgId)))
    ) {
      return NextResponse.json(
        { error: "Division not found" },
        { status: 400 }
      );
    }

    const section = await createBoqSection(result.boqId, result.data);
    return NextResponse.json(section, { status: 201 });
  }
);
