import { redirect } from "next/navigation";

/**
 * BOQ entry — server-side redirect to the only enabled sub-tab today.
 *
 * When more sub-tabs come online (RFQ, Client Proposal, etc.), this
 * redirect either stays pointed at My Scope (the canonical default)
 * or evolves into a sub-tab picker. For now, single visible tab → just
 * redirect.
 */
export default async function BoqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/boq/my-scope`);
}
