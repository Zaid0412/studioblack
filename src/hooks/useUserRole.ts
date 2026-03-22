"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/authClient";
import type { UserRole } from "@/types";

/**
 * Client-side hook that derives the effective user role from the session
 * and org membership (same logic as the server-side layout).
 *
 * Returns `{ role, session, loading }`.
 */
export function useUserRole() {
  const { data: session } = authClient.useSession();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [session]);

  return { role, session, loading };
}
