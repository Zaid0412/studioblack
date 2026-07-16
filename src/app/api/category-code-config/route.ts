import { NextResponse } from "next/server";
import { getCategoryCodeConfig, upsertCategoryCodeConfig } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  updateCategoryCodeConfigSchema,
} from "@/lib/validations";
import { CATEGORY_CODE_CONFIG_DEFAULTS } from "@/lib/categoryCode";

/** GET /api/category-code-config — the org's coding config (defaults if unset). */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ config: CATEGORY_CODE_CONFIG_DEFAULTS });
    }
    const config = await getCategoryCodeConfig(orgId);
    return NextResponse.json({ config });
  }
);

/** PATCH /api/category-code-config — update the org's coding config. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, updateCategoryCodeConfigSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const b = parsed.data;
    const config = await upsertCategoryCodeConfig(orgId, {
      auto_generate: b.autoGenerate,
      code_max_length: b.codeMaxLength,
      force_uppercase: b.forceUppercase,
      prevent_duplicates: b.preventDuplicates,
      lock_after_use: b.lockAfterUse,
    });
    return NextResponse.json({ config });
  }
);
