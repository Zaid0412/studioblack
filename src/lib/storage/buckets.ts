/** Supabase Storage bucket names. Keep literals in one place so renames don't drift. */
export const BUCKETS = {
  attachments: "attachments",
  avatars: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
