import { useMemo } from "react";
import useSWR from "swr";
import { authClient } from "@/lib/authClient";
import type { OrgMember } from "@/types";

async function fetchOrgMembers(): Promise<OrgMember[]> {
  const { data } = await authClient.organization.getFullOrganization();
  if (!data?.members) return [];
  return data.members as OrgMember[];
}

/** Fetch org members with optional filtering. Defaults to assignable only (admins + members). */
export function useOrgMembers(options?: { assignableOnly?: boolean }) {
  const { assignableOnly = true } = options ?? {};
  const { data: allMembers = [], isLoading } = useSWR<OrgMember[]>(
    "org-members",
    fetchOrgMembers
  );
  const members = useMemo(
    () =>
      assignableOnly
        ? allMembers.filter((m) => m.role === "member" || m.role === "admin")
        : allMembers,
    [allMembers, assignableOnly]
  );
  return { members, isLoading };
}
