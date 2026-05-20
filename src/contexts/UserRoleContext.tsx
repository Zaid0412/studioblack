"use client";

import { createContext, useContext, useMemo } from "react";
import type { UserRole } from "@/types";

interface UserRoleContextValue {
  role: UserRole;
  userId: string;
  /**
   * Raw better-auth org role: `"owner" | "admin" | "member" | "client" | "vendor"`,
   * or `null` for users without org membership. Use this to distinguish owners
   * from admins — both collapse to `role === "pm"` for app-level access checks.
   */
  orgRole: string | null;
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

/** Provides user role and ID to the component tree. */
export function UserRoleProvider({
  role,
  userId,
  orgRole,
  children,
}: {
  role: UserRole;
  userId: string;
  orgRole: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ role, userId, orgRole }),
    [role, userId, orgRole]
  );
  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

/** Returns the server-derived role from context, or null if outside the provider. */
export function useUserRoleContext() {
  return useContext(UserRoleContext);
}
