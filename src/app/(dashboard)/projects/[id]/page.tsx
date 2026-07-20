import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/serverSession";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { OverviewTab } from "./_components/OverviewTab";

/**
 * Project detail entry. With the `overviewTab` flag on it renders the Overview
 * (the project home); off, it reverts to the pre-Overview behaviour of
 * redirecting to Designs. Old `?tab=boq`/`?tab=order` bookmarks still redirect.
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

  const session = await getServerSession();
  const overviewOn = await getServerFeatureFlag(
    "overviewTab",
    session?.user.id ?? "anonymous",
    true
  );
  if (!overviewOn) redirect(`/projects/${id}/designs`);

  return <OverviewTab projectId={id} />;
}
