"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { isExternalViewer } from "@/lib/roles";

/**
 * RFQ route guard. The API layer already returns 403 to clients and vendors,
 * but a direct URL would still render the page shell and a broken empty
 * state. This layout bounces external viewers back to the project root so
 * the procurement surface is unreachable end-to-end.
 */
export default function OrderRfqLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id: projectId } = use(params);
  const { role, loading } = useUserRole();
  const router = useRouter();
  const blocked = isExternalViewer(role);

  useEffect(() => {
    if (!loading && blocked) {
      router.replace(`/projects/${projectId}`);
    }
  }, [loading, blocked, router, projectId]);

  if (blocked) return null;
  return <>{children}</>;
}
