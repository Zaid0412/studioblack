"use client";

import { useUserRole } from "./useUserRole";
import { useFlag } from "./useFlag";

/**
 * Whether the current user may manage the shared element-category taxonomy:
 * the `elementLibrary` flag is on AND they are a PM or architect. Single source
 * of truth for the category-management gate (elements + vendor sidebars and the
 * settings editor). `loading` mirrors the role-resolution state.
 */
export function useCanManageCategories(): {
  canManage: boolean;
  loading: boolean;
} {
  const { role, loading } = useUserRole();
  const elementLibraryEnabled = useFlag("elementLibrary");
  return {
    canManage: elementLibraryEnabled && (role === "pm" || role === "architect"),
    loading,
  };
}
