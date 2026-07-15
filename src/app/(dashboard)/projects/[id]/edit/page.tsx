import { redirect } from "next/navigation";

/**
 * The project edit form moved into the project Settings page. Keep this route as
 * a redirect so existing links/bookmarks land on the Details section.
 */
export default async function EditProjectRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/settings?section=details`);
}
