import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { writeElementSheet } from "@/lib/excel/elementWriter";
import type { Element } from "@/types";

/**
 * GET /api/elements/import/template
 *
 * Streams a .xlsx file with the element-import column headers and two
 * example rows. Lets a user start from a correctly-shaped file instead of
 * guessing the column layout. Reuses `writeElementSheet` so the generated
 * file is byte-identical in structure to what `/api/elements/export`
 * produces, guaranteeing round-trip parity.
 */
export const GET = withAuth({ allowedRoles: ["pm", "architect"] }, async () => {
  const sample = buildSampleRows();
  const buffer = await writeElementSheet(sample, []);

  const headers = new Headers({
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition":
      "attachment; filename=\"elements-template.xlsx\"; filename*=UTF-8''elements-template.xlsx",
  });
  return new NextResponse(new Uint8Array(buffer), { headers });
});

/**
 * Two illustrative rows — one with most fields populated, one minimal — so
 * the user immediately sees both "this is what a complete row looks like"
 * and "these are the bare minimum required fields."
 */
function buildSampleRows(): Element[] {
  const base = {
    org_id: "",
    category_id: null,
    is_active: true,
    image_url: null,
    drawing_file_url: null,
    drawing_file_name: null,
    spec_file_url: null,
    spec_file_name: null,
    version_group: "",
    version_number: 1,
    created_by: null,
    created_at: "",
    updated_at: "",
  } as const;

  return [
    {
      ...base,
      id: "sample-1",
      code: "SAMPLE-001",
      name: "Porcelain Floor Tile 600x600",
      description: "Glazed porcelain, rectified edges",
      unit: "m2",
      unit_cost: "45.00",
      currency: "USD",
      material_cost: "30.00",
      labour_cost: "10.00",
      overhead_pct: "5.00",
      margin_pct: "15.00",
      spec_reference: "ASTM C648",
      drawing_ref: "FLR-001",
      tags: ["floor", "tile"],
    } as Element,
    {
      ...base,
      id: "sample-2",
      code: "SAMPLE-002",
      name: "Standard Latex Paint",
      description: null,
      unit: "lm",
      unit_cost: "12.00",
      currency: "USD",
      material_cost: null,
      labour_cost: null,
      overhead_pct: null,
      margin_pct: null,
      spec_reference: null,
      drawing_ref: null,
      tags: null,
    } as Element,
  ];
}
