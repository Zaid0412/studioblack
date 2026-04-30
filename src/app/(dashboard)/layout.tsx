import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { MobileShell } from "@/components/layout/MobileShell";
import { deriveInitials } from "@/lib/utils";
import { deriveEffectiveRole } from "@/lib/effectiveRole";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InvitationBanner } from "@/components/layout/InvitationBanner";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { PostHogIdentify } from "@/components/providers/PostHogIdentify";
import type { User } from "@/types";

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

  const effectiveRole = await deriveEffectiveRole(
    session.user.id,
    orgId,
    session.user.role
  );

  // Org name for PostHog group analytics. Optional — clients have no org.
  let orgName: string | null = null;
  if (orgId) {
    const fullOrg = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: orgId },
    });
    orgName = fullOrg?.name ?? null;
  }

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
          <PostHogIdentify
            userId={user.id}
            email={user.email}
            name={user.name}
            organizationId={orgId ?? undefined}
            organizationName={orgName ?? undefined}
          />
          <div className="flex h-screen overflow-hidden">
            {/* Desktop sidebar — hidden on mobile */}
            <div className="hidden lg:block">
              <Sidebar variant={effectiveRole} user={user} />
            </div>

            <div className="flex flex-col flex-1 min-h-0 min-w-0">
              {/* Mobile top bar + bottom nav */}
              <MobileShell user={user} />

              <main className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pb-20 lg:p-8 lg:pr-20 lg:pb-8">
                <div className="fixed top-4 right-4 lg:right-8 z-50 hidden lg:block">
                  <NotificationPanel />
                </div>
                <InvitationBanner />
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
        </UserRoleProvider>
      </SidebarProvider>
    </SWRProvider>
  );
}
