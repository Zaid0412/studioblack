import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * New project layout — PM only.
 * Architects cannot create projects, only update them.
 */
export default async function NewProjectLayout({
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

  if (session.user.role !== "pm") {
    redirect("/projects");
  }

  return <>{children}</>;
}
