import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  writeElementSheet,
  type WritableElement,
} from "@/lib/excel/elementWriter";

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
    // Sample template is deterministic — let CDN + browser cache for a day.
    "Cache-Control": "public, max-age=86400, immutable",
  });
  return new NextResponse(new Uint8Array(buffer), { headers });
});

/**
 * Two illustrative rows — one with most fields populated, one minimal — so
 * the user immediately sees both "this is what a complete row looks like"
 * and "these are the bare minimum required fields."
 */
function buildSampleRows(): WritableElement[] {
  return [
    {
      category_id: null,
      code: "SAMPLE-001",
      name: "Porcelain Floor Tile 600x600",
      description: "Glazed porcelain, rectified edges",
      unit: "m2",
      unit_cost: "45.00",
      currency: "USD",
      material_cost: "30.00",
      labour_cost: "10.00",
      overhead_pct: "5.00",
      service_charge_pct: "0.00",
      margin_pct: "15.00",
      client_rate: "55.00",
      budget_rate: "42.00",
      spec_reference: "ASTM C648",
      drawing_ref: "FLR-001",
      tags: ["floor", "tile"],
    },
    {
      category_id: null,
      // Blank on purpose: leave Code empty and the element is coded from its
      // category on import (KIT-CAB-BASE-0001). Fill it in only to update an
      // element that already exists — the code is what the row matches on.
      code: "",
      name: "Standard Latex Paint",
      description: null,
      unit: "lm",
      unit_cost: "12.00",
      currency: "USD",
      material_cost: null,
      labour_cost: null,
      overhead_pct: null,
      service_charge_pct: null,
      margin_pct: null,
      client_rate: null,
      budget_rate: null,
      spec_reference: null,
      drawing_ref: null,
      tags: null,
    },
  ];
}
