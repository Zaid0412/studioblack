/** The 6 default project phases (file categories) — auto-created for every new project. */
export const PROJECT_PHASES = [
  "2D Layout",
  "3D Layout",
  "Production Plan",
  "Section View",
  "Plumbing",
  "Floor Plans",
] as const;

/** The 7 high-level workflow steps — auto-created for every new project. */
export const PROJECT_STEPS = [
  "Recce",
  "Design",
  "BOQ",
  "Order",
  "Work Progress",
  "Snag",
  "Finance",
] as const;

/** SWR polling interval for background data refresh (notifications, invitations, etc.). */
export const POLLING_INTERVAL_MS = 30_000;

/** Maximum character length for user-submitted content (pin comments, reviews, etc.). */
export const MAX_CONTENT_LENGTH = 5_000;

/** Default pagination limit when no explicit limit is provided. */
export const DEFAULT_PAGE_LIMIT = 200;

/**
 * Currency every money field is pre-filled with. Users can change it per record
 * — `CurrencySelect` offers the full ISO 4217 list.
 *
 * This is the *default for new rows only*. Existing rows keep whatever currency
 * they were saved with; changing this must never rewrite them, or the number in
 * the column would silently start meaning something else.
 */
export const DEFAULT_CURRENCY = "INR";
