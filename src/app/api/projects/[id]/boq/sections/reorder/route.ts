import { NextResponse } from "next/server";
import { reorderBoqSections } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { reorderSectionsSchema } from "@/lib/validations";
import { parseBoqRequest } from "../../_helpers";

export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const result = await parseBoqRequest(req, params.id, reorderSectionsSchema);
    if (!result.ok) return result.response;

    await reorderBoqSections(result.boqId, result.data.orderedIds);
    return NextResponse.json({ ok: true });
  }
);
