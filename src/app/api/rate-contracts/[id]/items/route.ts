import { NextResponse } from "next/server";
import { addRateContractItems } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, addRateContractItemsSchema } from "@/lib/validations";

/** POST /api/rate-contracts/[id]/items — bulk-add or upsert items. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const parsed = await parseRequest(req, addRateContractItemsSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const result = await addRateContractItems(
      orgId,
      params.id,
      parsed.data.items
    );
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "Rate contract not found" },
          { status: 404 }
        );
      }
      if (result.reason === "currency_mismatch") {
        return NextResponse.json(
          {
            error:
              "Element currency must match contract currency (multi-currency not yet supported)",
          },
          { status: 400 }
        );
      }
      if (result.reason === "element_not_found") {
        return NextResponse.json(
          { error: "One or more elements were not found in this org" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    return NextResponse.json({ success: true, count: result.count });
  }
);
