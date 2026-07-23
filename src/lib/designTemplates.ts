/**
 * Defaults for the Design → Document Control module (PRD "01.Design doc").
 *
 * Design packages are the milestone submissions a project's drawings are grouped
 * under (they replace the legacy 6 design phases); disciplines are a per-org
 * lookup that companies may extend with custom entries.
 */

import type { Representation } from "@/lib/validations";

export interface DesignPackageTemplate {
  code: string;
  name: string;
}

/** The 6 default design packages — seeded per project on create. */
export const DESIGN_PACKAGE_DEFAULTS: ReadonlyArray<DesignPackageTemplate> = [
  { code: "CON", name: "Concept Design" },
  { code: "SCH", name: "Schematic Design" },
  { code: "DD", name: "Design Development" },
  { code: "TD", name: "Technical / Tender Design" },
  { code: "IFC", name: "Issued for Construction" },
  { code: "ASB", name: "As-Built Documentation" },
];

export interface DisciplineTemplate {
  code: string;
  name: string;
}

/** Human labels for the drawing-type codes (PDS v2.0 §4C — the 13 types). */
export const DRAWING_TYPE_LABELS: Record<string, string> = {
  PLAN: "Floor Plan",
  ELEV: "Elevation",
  SECT: "Section",
  DET: "Detail",
  PROD: "Production Drawing",
  SHOP: "Shop Drawing",
  RCP: "Reflected Ceiling Plan",
  ISO: "Isometric",
  SCH: "Schedule",
  SPEC: "Specification",
  REND: "Rendering",
  MOD: "BIM Model",
  CAL: "Calculation Sheet",
};

/** Human labels for the representation codes (PDS v2.0 §4D). */
export const REPRESENTATION_LABELS: Record<Representation, string> = {
  "2D": "2D Drawing",
  "3D": "3D Model",
  REN: "Rendering",
  VR: "Walkthrough / Animation",
};

/**
 * The 10 default disciplines — seeded per org; extendable with custom entries.
 * Codes follow PDS v2.0 §4B; existing orgs are reconciled in-place by
 * `migrate-drawing-representation-location.sql` (names are unchanged).
 */
export const DISCIPLINE_DEFAULTS: ReadonlyArray<DisciplineTemplate> = [
  { code: "AR", name: "Architecture" },
  { code: "ID", name: "Interior Design" },
  { code: "ST", name: "Structural" },
  { code: "ELC", name: "Electrical" },
  { code: "PLB", name: "Plumbing" },
  { code: "MEC", name: "Mechanical" },
  { code: "HVAC", name: "HVAC" },
  { code: "LND", name: "Landscape" },
  { code: "FUR", name: "Furniture" },
  { code: "VIS", name: "Visualization" },
];
