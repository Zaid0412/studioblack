import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/serverSession";

/**
 * Organisation layout — PM only (owner/admin org roles).
 * Architects are redirected to the dashboard.
 */
export default async function OrganisationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  // Only PMs can manage the organisation
  if (session.user.role !== "pm") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
