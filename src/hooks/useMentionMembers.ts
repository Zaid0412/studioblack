import useSWR from "swr";
import { API } from "@/lib/api/routes";
import type { MentionMember } from "@/types";

export function useMentionMembers(projectId: string) {
  const { data, isLoading } = useSWR<MentionMember[]>(
    projectId ? API.projectMembers(projectId) : null
  );

  return {
    members: data ?? [],
    isLoading,
  };
}
