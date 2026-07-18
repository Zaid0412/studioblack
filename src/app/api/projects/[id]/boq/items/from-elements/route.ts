import { NextResponse } from "next/server";
import { addElementsToBoq, divisionBelongsToOrg } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { addElementsToBoqSchema } from "@/lib/validations";
import { parseBoqRequest } from "../../_helpers";

/**
 * Batch variant of `from-element`: take an array of `items` and insert
 * one BOQ line per element under the same section. Returns the array
 * of inserted rows (with computed cost columns) so the client can
 * splice them into the SWR cache.
 *
 * Atomic (all-or-nothing): if any element id can't be resolved, nothing
 * is inserted and this returns 404.
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const result = await parseBoqRequest(
      req,
      params.id,
      addElementsToBoqSchema
    );
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

    const items = await addElementsToBoq(result.boqId, orgId, result.data);
    if (!items) {
      return NextResponse.json(
        { error: "One or more elements could not be resolved" },
        { status: 404 }
      );
    }
    return NextResponse.json({ items }, { status: 201 });
  }
);
