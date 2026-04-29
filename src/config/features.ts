/**
 * Feature flags for conditionally enabling UI sections and routes.
 *
 * Sidebar nav items, route guards, and UI blocks read these flags so
 * disabling a feature hides it cleanly without breaking anything.
 */
export const features = {
  magicLink: false,
  teamManagement: true,
  auditHistory: true,
  clientPortal: true,
  notifications: true,
  designUpload: true,
  emailVerification: true,
  elementLibrary: true,
  boq: true,
  vendorManagement: true,
  rateContracts: true,
} as const;
