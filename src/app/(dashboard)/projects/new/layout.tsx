import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/serverSession";

/**
 * New project layout — PM only.
 * Architects cannot create projects, only update them.
 */
export default async function NewProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role !== "pm") {
    redirect("/projects");
  }

  return <>{children}</>;
}
