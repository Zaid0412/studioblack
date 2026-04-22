import crypto from "crypto";

/**
 * Generate a 32-char alphanumeric ID matching better-auth's format.
 * Uses the same charset (a-z, A-Z, 0-9) and length as better-auth's generateId.
 */
export function generateBetterAuthId(size = 32): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const limit = 256 - (256 % chars.length); // rejection threshold to avoid modulo bias
  let result = "";
  while (result.length < size) {
    const bytes = crypto.randomBytes(size - result.length);
    for (let i = 0; i < bytes.length && result.length < size; i++) {
      if (bytes[i] < limit) {
        result += chars[bytes[i] % chars.length];
      }
    }
  }
  return result;
}

/** Escape SQL LIKE/ILIKE wildcards so user input is treated as literal text. */
export function escapeSqlLike(str: string): string {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
