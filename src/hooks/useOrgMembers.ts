import { useMemo } from "react";
import useSWR from "swr";
import { authClient } from "@/lib/authClient";
import type { OrgMember } from "@/types";

async function fetchOrgMembers(): Promise<OrgMember[]> {
  const { data } = await authClient.organization.getFullOrganization();
  if (!data?.members) return [];
  return data.members as OrgMember[];
}

type OrgMembersOptions =
  | { assignableOnly?: boolean; roleFilter?: never }
  | { roleFilter: string; assignableOnly?: never };

/** Fetch org members with optional filtering. Defaults to assignable only (admins + members). */
export function useOrgMembers(options?: OrgMembersOptions) {
  const { assignableOnly = true, roleFilter } = options ?? {};
  const { data: allMembers = [], isLoading } = useSWR<OrgMember[]>(
    "org-members",
    fetchOrgMembers
  );
  const members = useMemo(() => {
    if (roleFilter) {
      return allMembers.filter((m) => m.role === roleFilter);
    }
    return assignableOnly
      ? allMembers.filter((m) => m.role === "member" || m.role === "admin")
      : allMembers;
  }, [allMembers, assignableOnly, roleFilter]);
  return { members, isLoading };
}
