import { redirect } from "next/navigation";
import { OverviewTab } from "./_components/OverviewTab";

/**
 * Project detail entry — renders the Overview (the project home). Old
 * `?tab=boq` bookmarks still redirect to the BOQ tab so they keep working.
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
  if (tab === "order") redirect(`/projects/${id}/order`);

  return <OverviewTab projectId={id} />;
}
