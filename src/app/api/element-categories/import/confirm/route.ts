import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  applyCategoryImport,
  CategoryImportBlockedError,
  DuplicateCategoryError,
} from "@/lib/queries/categoryImport";
import { importCategoriesSchema } from "@/lib/validations";

/**
 * POST /api/element-categories/import/confirm
 *
 * Commit an import. The body is the chains the preview parsed, but every one is
 * re-validated and the plan is re-derived server-side — the preview is a
 * courtesy, not a promise, and the client could have edited what it sends back.
 *
 * 409 when the sheet would remove a category that something still points at.
 * Nothing is written in that case.
 */
export const POST = withAuth(
  {
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = importCategoriesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid import payload" },
        { status: 400 }
      );
    }

    try {
      const result = await applyCategoryImport(
        orgId,
        parsed.data.paths.map((path) =>
          path.map((n) => ({ name: n.name, codePrefix: n.codePrefix ?? null }))
        )
      );
      return NextResponse.json(result);
    } catch (err) {
      if (err instanceof CategoryImportBlockedError) {
        return NextResponse.json(
          { error: "Some categories are still in use", blocked: err.blocked },
          { status: 409 }
        );
      }
      // A user-fixable data problem — two categories share a name path — not a
      // server fault. Tell them which one.
      if (err instanceof DuplicateCategoryError) {
        return NextResponse.json(
          {
            error: `Two categories share the path "${err.path}". Rename one, then import.`,
          },
          { status: 409 }
        );
      }
      // Anything else — a deadlock, a dropped connection, a constraint we
      // didn't anticipate — is ours, not the client's. Let it 500 rather than
      // dressing it up as a 400 with the raw DB message in the body.
      throw err;
    }
  }
);
