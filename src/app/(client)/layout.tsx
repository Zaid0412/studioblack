import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { deriveInitials } from "@/lib/utils";
import type { User } from "@/types";

/**
 * Client layout — protected, client role only.
 *
 * Performs full session validation via `auth.api.getSession()` (DB lookup).
 * Redirects unauthenticated users to `/login` and PMs/architects to `/dashboard`.
 * Passes the authenticated user to the Sidebar as a typed `User` prop.
 */
export default async function ClientLayout({
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

  // PMs and architects should not be in the client portal
  if (session.user.role === "pm" || session.user.role === "architect") {
    redirect("/dashboard");
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
        <Sidebar variant="client" user={user} />
        <main className="relative flex-1 min-h-0 overflow-y-auto p-8">
          <div className="fixed top-4 right-8 z-40">
            <NotificationPanel />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
