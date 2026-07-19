"use client";

import useSWR from "swr";
import type { ProjectOverview } from "@/types";
import { API } from "@/lib/api/routes";

/** Aggregated project Overview dashboard (KPIs, charts, activity). */
export function useProjectOverview(projectId: string) {
  const { data, isLoading, error, mutate } = useSWR<ProjectOverview>(
    API.projectOverview(projectId)
  );
  return { overview: data, loading: isLoading, error: !!error, mutate };
}
