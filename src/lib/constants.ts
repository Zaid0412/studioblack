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
