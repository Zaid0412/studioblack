export const features = {
  magicLink: true,
  teamManagement: true,
  auditHistory: true,
  clientPortal: true,
  notifications: true,
  designUpload: true,
} as const;

export type Features = typeof features;
