"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/authClient";
import { useUserRoleContext } from "@/contexts/UserRoleContext";
import type { UserRole } from "@/types";

/**
 * Client-side hook that returns the effective user role.
 *
 * When rendered inside the dashboard layout's `UserRoleProvider`, returns the
 * server-derived role instantly (no API call, no loading state).
 *
 * Falls back to the client-side derivation (API call) if no provider is present.
 *
 * Returns `{ role, session, loading }`.
 */
export function useUserRole() {
  const ctx = useUserRoleContext();
  const { data: session } = authClient.useSession();
  const [role, setRole] = useState<UserRole | null>(ctx?.role ?? null);
  const [loading, setLoading] = useState(!ctx);

  useEffect(() => {
    // If we have the role from context, no need to derive
    if (ctx) return;
    if (!session?.user) return;

    async function derive() {
      const userRole = session!.user.role as string | undefined;

      if (userRole === "client") {
        setRole("client");
        setLoading(false);
        return;
      }

      const orgId = session!.session.activeOrganizationId;
      if (orgId) {
        try {
          const { data: org } =
            await authClient.organization.getFullOrganization();
          const me = org?.members?.find(
            (m: { userId: string }) => m.userId === session!.user.id
          );
          if (me?.role === "owner" || me?.role === "admin") {
            setRole("pm");
          } else if (me?.role === "client") {
            setRole("client");
          } else if (me?.role === "member") {
            setRole("architect");
          } else {
            setRole((userRole as UserRole) ?? "pm");
          }
        } catch {
          setRole((userRole as UserRole) ?? "pm");
        }
      } else {
        setRole((userRole as UserRole) ?? "pm");
      }

      setLoading(false);
    }

    derive();
  }, [session, ctx]);

  return { role, session, loading };
}
