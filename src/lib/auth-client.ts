import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

/**
 * Client-side Better Auth instance for React components.
 *
 * `inferAdditionalFields<typeof auth>()` gives TypeScript full knowledge of
 * custom user fields (`role`, `initials`) without duplicating type definitions.
 * `organizationClient()` enables org management methods on the client.
 * The `auth` import is type-only — no server code is bundled into the client.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), organizationClient()],
});
