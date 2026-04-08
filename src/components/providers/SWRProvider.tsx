"use client";

import { SWRConfig } from "swr";
import { swrConfig } from "@/lib/swr";

/** Client-side SWR provider with global defaults. */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>;
}
