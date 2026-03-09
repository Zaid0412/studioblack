import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Catch-all API route for Better Auth.
 *
 * Handles every authentication endpoint:
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-up/email
 * - POST /api/auth/sign-out
 * - GET  /api/auth/get-session
 * - etc.
 */
export const { GET, POST } = toNextJsHandler(auth);
