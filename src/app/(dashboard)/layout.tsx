import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { deriveInitials } from "@/lib/utils";
import type { User } from "@/types";

/**
 * Dashboard layout — protected, PM and architect only.
 *
 * Performs full session validation via `auth.api.getSession()` (DB lookup).
 * Redirects unauthenticated users to `/login` and clients to `/client-dashboard`.
 * Passes the authenticated user to the Sidebar with the correct role variant.
 */
export default async function DashboardLayout({
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

  // Clients should not access the architect dashboard
  if (session.user.role === "client") {
    redirect("/client-dashboard");
  }



  const user: User = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as User["role"],
    initials: session.user.initials || deriveInitials(session.user.name),
    avatar: session.user.image ?? undefined,
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar variant={user.role === "pm" ? "pm" : "architect"} user={user} />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </SidebarProvider>
  );
}
