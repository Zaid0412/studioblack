import { NextResponse } from "next/server";
import { addElementToBoq, divisionBelongsToOrg } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { addElementToBoqSchema } from "@/lib/validations";
import { parseBoqRequest } from "../../_helpers";

export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const result = await parseBoqRequest(req, params.id, addElementToBoqSchema);
    if (!result.ok) return result.response;

    if (
      result.data.divisionId !== undefined &&
      !(await divisionBelongsToOrg(result.data.divisionId, orgId))
    ) {
      return NextResponse.json(
        { error: "Division not found in this organization" },
        { status: 400 }
      );
    }

    const item = await addElementToBoq(result.boqId, orgId, result.data);
    if (!item) {
      return NextResponse.json({ error: "Element not found" }, { status: 404 });
    }
    return NextResponse.json(item, { status: 201 });
  }
);
