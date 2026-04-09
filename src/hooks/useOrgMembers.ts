import useSWR from "swr";
import { authClient } from "@/lib/authClient";
import type { OrgMember } from "@/types";

async function fetchAssignableMembers(): Promise<OrgMember[]> {
  const { data } = await authClient.organization.getFullOrganization();
  if (!data?.members) return [];
  return (data.members as OrgMember[]).filter(
    (m) => m.role === "member" || m.role === "admin"
  );
}

/** Fetch org members who can be assigned to projects (admins + members). */
export function useOrgMembers() {
  const { data: members = [], isLoading } = useSWR<OrgMember[]>(
    "org-members",
    fetchAssignableMembers
  );
  return { members, isLoading };
}
