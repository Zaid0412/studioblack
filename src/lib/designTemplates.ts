/**
 * Defaults for the Design → Document Control module (PRD "01.Design doc").
 *
 * Design packages are the milestone submissions a project's drawings are grouped
 * under (they replace the legacy 6 design phases); disciplines are a per-org
 * lookup that companies may extend with custom entries.
 */

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

/** The 10 default disciplines — seeded per org; extendable with custom entries. */
export const DISCIPLINE_DEFAULTS: ReadonlyArray<DisciplineTemplate> = [
  { code: "AR", name: "Architecture" },
  { code: "ID", name: "Interior Design" },
  { code: "ST", name: "Structural" },
  { code: "EL", name: "Electrical" },
  { code: "PL", name: "Plumbing" },
  { code: "ME", name: "Mechanical" },
  { code: "HVAC", name: "HVAC" },
  { code: "LS", name: "Landscape" },
  { code: "FF", name: "Furniture" },
  { code: "3D", name: "Visualization" },
];
