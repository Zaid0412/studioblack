import { redirect } from "next/navigation";
import { DEFAULT_ORDER_SEGMENT } from "./_lib/tabs";

/** Order entry — server-side redirect to the default sub-tab. */
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/order/${DEFAULT_ORDER_SEGMENT}`);
}
