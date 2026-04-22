import { NextResponse } from "next/server";
import { reorderBoqItems } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { reorderItemsSchema } from "@/lib/validations";
import { parseBoqRequest } from "../../_helpers";

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const result = await parseBoqRequest(req, params.id, reorderItemsSchema);
    if (!result.ok) return result.response;

    await reorderBoqItems(
      result.boqId,
      result.data.sectionId,
      result.data.orderedIds
    );
    return NextResponse.json({ ok: true });
  }
);
