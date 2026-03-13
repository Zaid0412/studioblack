import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Organisation layout — PM only (owner/admin org roles).
 * Architects are redirected to the dashboard.
 */
export default async function OrganisationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  // Only PMs can manage the organisation
  if (session.user.role !== "pm") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
