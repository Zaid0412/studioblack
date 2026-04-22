import { NextResponse } from "next/server";
import { createBoqItem } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createBoqItemSchema } from "@/lib/validations";
import { parseBoqRequest } from "../_helpers";

export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const result = await parseBoqRequest(req, params.id, createBoqItemSchema);
    if (!result.ok) return result.response;

    const item = await createBoqItem(result.boqId, orgId, result.data);
    return NextResponse.json(item, { status: 201 });
  }
);
