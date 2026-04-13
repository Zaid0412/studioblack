import { apiGet } from "./client";
import { API } from "./routes";
import type { MentionMember } from "@/types";

/** Fetch project members for @mention autocomplete. */
export function getProjectMembers(projectId: string) {
  return apiGet<MentionMember[]>(API.projectMembers(projectId));
}
