"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/types";

interface UserRoleContextValue {
  role: UserRole;
  userId: string;
}

const UserRoleContext = createContext<UserRoleContextValue | null>(null);

export function UserRoleProvider({
  role,
  userId,
  children,
}: {
  role: UserRole;
  userId: string;
  children: React.ReactNode;
}) {
  return (
    <UserRoleContext.Provider value={{ role, userId }}>
      {children}
    </UserRoleContext.Provider>
  );
}

/** Returns the server-derived role from context, or null if outside the provider. */
export function useUserRoleContext() {
  return useContext(UserRoleContext);
}
