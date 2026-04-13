import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { MobileShell } from "@/components/layout/MobileShell";
import { deriveInitials } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SWRProvider } from "@/components/providers/SWRProvider";
import type { User } from "@/types";

/**
 * Derive the effective app role from the user's org membership.
 *
 * better-auth org roles → app roles:
 *   owner / admin → "pm"
 *   member        → "architect"
 *
 * Falls back to user.role for users without an org (e.g. clients).
 */
async function getEffectiveRole(
  userId: string,
  orgId: string | null | undefined,
  fallbackRole: string | null | undefined
): Promise<"pm" | "architect" | "client"> {
  // user.role is authoritative for clients — changing a client's org role
  // alone won't promote them; their user.role must also be updated in the DB.
  if (fallbackRole === "client") return "client";
  if (!orgId) return (fallbackRole as "pm" | "architect") ?? "pm";

  const members = await auth.api.listMembers({
    headers: await headers(),
    query: { organizationId: orgId },
  });

  const me = members?.members?.find(
    (m: { userId: string }) => m.userId === userId
  );

  if (me?.role === "owner" || me?.role === "admin") return "pm";
  if (me?.role === "client") return "client";
  if (me?.role === "member") return "architect";
  return (fallbackRole as "pm" | "architect") ?? "pm";
}

/**
 * Dashboard layout — protected, all authenticated roles.
 *
 * Performs full session validation via `auth.api.getSession()` (DB lookup).
 * Redirects unauthenticated users to `/login`.
 * Auto-sets active organization if the user belongs to one but hasn't selected it.
 * Derives effective role from org membership (owner/admin → PM, member → architect).
 * Clients are allowed — pages handle role-specific content themselves.
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

  // Auto-set active org if not set
  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const orgs = await auth.api.listOrganizations({
      headers: await headers(),
    });
    if (orgs && orgs.length > 0) {
      orgId = orgs[0].id;
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: orgId },
      });
    }
  }

  const effectiveRole = await getEffectiveRole(
    session.user.id,
    orgId,
    session.user.role
  );

  const user: User = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: effectiveRole,
    initials: session.user.initials || deriveInitials(session.user.name),
    avatar: session.user.image ?? undefined,
  };

  return (
    <SWRProvider>
      <SidebarProvider>
        <UserRoleProvider role={effectiveRole} userId={user.id}>
          <div className="flex h-screen overflow-hidden">
            {/* Desktop sidebar — hidden on mobile */}
            <div className="hidden lg:block">
              <Sidebar variant={effectiveRole} user={user} />
            </div>

            <div className="flex flex-col flex-1 min-h-0 min-w-0">
              {/* Mobile top bar + bottom nav + sidebar sheet */}
              <MobileShell user={user} variant={effectiveRole} />

              <main className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pb-20 lg:p-8 lg:pr-20 lg:pb-8">
                <div className="fixed top-4 right-4 lg:right-8 z-50 hidden lg:block">
                  <NotificationPanel />
                </div>
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </UserRoleProvider>
      </SidebarProvider>
    </SWRProvider>
  );
}
