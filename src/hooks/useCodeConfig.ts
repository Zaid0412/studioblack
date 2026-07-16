"use client";

import useSWR from "swr";
import { API } from "@/lib/api/routes";
import { CATEGORY_CODE_CONFIG_DEFAULTS } from "@/lib/categoryCode";
import type { CategoryCodeConfig } from "@/types";

/**
 * The org's element-category coding config (auto-generate, max length, force
 * uppercase, prevent duplicates, lock after use). Returns the defaults until the
 * fetch resolves so forms can render immediately. Shared SWR key → cache hit
 * across the category form, service-area dialog, import dialog, and settings.
 */
export function useCodeConfig() {
  const { data, isLoading, mutate } = useSWR<{ config: CategoryCodeConfig }>(
    API.categoryCodeConfig()
  );
  return {
    config: data?.config ?? CATEGORY_CODE_CONFIG_DEFAULTS,
    isLoading,
    loaded: data !== undefined,
    mutate,
  };
}
