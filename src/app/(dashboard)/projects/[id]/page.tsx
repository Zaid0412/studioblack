import { redirect } from "next/navigation";

/**
 * Project detail entry — redirects to the active tab.
 *
 * - Default: `/projects/[id]/designs`.
 * - Legacy `?tab=boq` query param → `/projects/[id]/boq` (which itself
 *   redirects to `/boq/my-scope`).
 * - Legacy `?tab=designs` → `/projects/[id]/designs`.
 *
 * Server-side redirect so old bookmarks and email links keep working
 * without a client-side flash.
 */
export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : null;

  if (tab === "boq") redirect(`/projects/${id}/boq`);
  redirect(`/projects/${id}/designs`);
}
