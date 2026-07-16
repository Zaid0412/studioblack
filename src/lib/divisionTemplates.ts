/**
 * Default Division library — the reusable org-level BOQ grouping level that sits
 * above sections (Project → BOQ → Division → Section → BOQ Item). Seeded on org
 * creation via `provisionNewOrg` and offered as "Restore defaults" in Settings.
 * Transcribed from the Arch PRD "BOQ Div/Section" tab (tab 10.1).
 */

export interface DivisionTemplate {
  /** Short code stored in division.code (e.g. GEN, CIV, HVAC). */
  code: string;
  name: string;
}

export const DIVISION_DEFAULTS: ReadonlyArray<DivisionTemplate> = [
  { code: "GEN", name: "General" },
  { code: "CIV", name: "Civil Works" },
  { code: "STR", name: "Structural Works" },
  { code: "MAS", name: "Masonry" },
  { code: "PLB", name: "Plumbing" },
  { code: "ELE", name: "Electrical" },
  { code: "HVAC", name: "HVAC" },
  { code: "INT", name: "Interior Works" },
  { code: "KIT", name: "Kitchen" },
  { code: "JNR", name: "Joinery" },
  { code: "FLR", name: "Flooring" },
  { code: "PNT", name: "Painting" },
];
