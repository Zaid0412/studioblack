import { redirect } from "next/navigation";

/**
 * Organisation management moved into Settings → Organization
 * (`/settings?section=organization`). This route now permanently redirects
 * so any existing bookmarks / in-app links keep working.
 */
export default function OrganisationPage() {
  redirect("/settings?section=organization");
}
