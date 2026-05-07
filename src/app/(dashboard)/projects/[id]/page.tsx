import { redirect } from "next/navigation";

/**
 * Project detail entry — server-side redirects to the active tab so
 * old `?tab=` bookmarks keep working without a client-side flash.
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
