"use client";

import { createContext, useContext, useMemo } from "react";
import type { UserRole } from "@/types";

interface UserRoleContextValue {
  role: UserRole;
  userId: string;
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

/** Provides user role and ID to the component tree. */
export function UserRoleProvider({
  role,
  userId,
  children,
}: {
  role: UserRole;
  userId: string;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ role, userId }), [role, userId]);
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
