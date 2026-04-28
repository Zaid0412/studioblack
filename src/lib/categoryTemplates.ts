/**
 * Starter taxonomy presets used by the "Use a starter set" flow on the
 * element library. Translations live in `messages/{en,tr}.json` under
 * `elements.starterCategories.*` — the `key` field below is the i18n key.
 *
 * Adding a new entry: extend the array, add the matching i18n keys in both
 * locale files. Children inherit no parent metadata; each child entry just
 * defines a name. Icons + colours come from the parent only — children get
 * default styling for now.
 */

export interface StarterCategoryChild {
  /** i18n key under `elements.starterCategories.<parentKey>.children.<key>` */
  key: string;
}

export interface StarterCategory {
  /** i18n key under `elements.starterCategories.<key>.name` */
  key: string;
  icon: string;
  color: string;
  children: StarterCategoryChild[];
}

export const STARTER_CATEGORIES: ReadonlyArray<StarterCategory> = [
  {
    key: "flooring",
    icon: "layers",
    color: "#8b5cf6",
    children: [
      { key: "tiles" },
      { key: "stone" },
      { key: "wood" },
      { key: "carpet" },
    ],
  },
  {
    key: "walls",
    icon: "square",
    color: "#06b6d4",
    children: [{ key: "paint" }, { key: "wallpaper" }, { key: "cladding" }],
  },
  {
    key: "ceiling",
    icon: "panels-top-left",
    color: "#0ea5e9",
    children: [{ key: "gypsum" }, { key: "acoustic" }, { key: "coffered" }],
  },
  {
    key: "plumbing",
    icon: "droplet",
    color: "#10b981",
    children: [{ key: "fixtures" }, { key: "pipes" }, { key: "sanitaryware" }],
  },
  {
    key: "electrical",
    icon: "zap",
    color: "#f59e0b",
    children: [{ key: "wiring" }, { key: "lighting" }, { key: "switches" }],
  },
  {
    key: "joinery",
    icon: "hammer",
    color: "#a3a3a3",
    children: [{ key: "cabinets" }, { key: "doors" }, { key: "windows" }],
  },
  {
    key: "furniture",
    icon: "armchair",
    color: "#ec4899",
    children: [{ key: "seating" }, { key: "tables" }, { key: "storage" }],
  },
  {
    key: "finishes",
    icon: "paintbrush",
    color: "#ef4444",
    children: [],
  },
];
