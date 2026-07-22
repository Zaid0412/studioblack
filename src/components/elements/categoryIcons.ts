/**
 * Curated icon sets for the category / sub-category / service-area pickers.
 * Names are Lucide PascalCase ids, resolved against `icons` from lucide-react.
 * A name that ever stops existing in Lucide is dropped at runtime by the
 * picker's `.filter`, and `category-icons.test.ts` guards the whole list.
 */

/** Architecture & construction group — the Browse-all default view. */
export const CURATED_CATEGORY_ICONS = [
  "House",
  "Building2",
  "Warehouse",
  "BrickWall",
  "Fence",
  "Blocks",
  "Hammer",
  "Wrench",
  "HardHat",
  "Construction",
  "Drill",
  "Ruler",
  "PencilRuler",
  "PanelTop",
  "Grid2x2",
  "Columns3",
  "DoorOpen",
  "DoorClosed",
  "Frame",
  "Sofa",
  "Armchair",
  "BedDouble",
  "Bath",
  "ShowerHead",
  "Toilet",
  "Droplets",
  "Waves",
  "Refrigerator",
  "Lightbulb",
  "Plug",
  "Fan",
  "Thermometer",
  "AirVent",
  "Landmark",
] as const;

/** Icon id → display label: `"PencilRuler"` → `"Pencil Ruler"`, `"Grid2x2"` → `"Grid 2x 2"`. */
export const humanizeIconName = (name: string) =>
  name.replace(/([A-Z0-9]+)/g, " $1").trim();

/** Inline quick-picks shown before "Browse all" — a compact construction subset. */
export const DEFAULT_CATEGORY_ICONS = [
  "House",
  "BrickWall",
  "PencilRuler",
  "Grid2x2",
  "Droplets",
  "Sofa",
] as const;
