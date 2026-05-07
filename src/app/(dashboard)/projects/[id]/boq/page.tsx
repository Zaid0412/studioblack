import { redirect } from "next/navigation";
import { DEFAULT_BOQ_SEGMENT } from "./_lib/tabs";

/** BOQ entry — server-side redirect to the default sub-tab. */
export default async function BoqPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/boq/${DEFAULT_BOQ_SEGMENT}`);
}
