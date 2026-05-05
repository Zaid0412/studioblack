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
import { TaskSidePanelHost } from "@/components/tasks/TaskSidePanelHost";
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
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login");
  }

  let orgId = session.session.activeOrganizationId;
  let orgName: string | null = null;

  if (!orgId) {
    const orgs = await auth.api.listOrganizations({ headers: reqHeaders });
    if (orgs && orgs.length > 0) {
      orgId = orgs[0].id;
      orgName = orgs[0].name ?? null;
      await auth.api.setActiveOrganization({
        headers: reqHeaders,
        body: { organizationId: orgId },
      });
    }
  }

  const [effectiveRole, fullOrg] = await Promise.all([
    deriveEffectiveRole(session.user.id, orgId, session.user.role),
    orgId && !orgName
      ? auth.api.getFullOrganization({
          headers: reqHeaders,
          query: { organizationId: orgId },
        })
      : null,
  ]);
  if (fullOrg) orgName = fullOrg.name ?? null;

  // Vendors are scoped to /vendor-portal/* and /settings/*. Block them from
  // PM/architect/client surfaces — they would only see empty states anyway.
  if (effectiveRole === "vendor") {
    const pathname = reqHeaders.get("x-pathname") ?? "";
    if (
      !pathname.startsWith("/vendor-portal") &&
      !pathname.startsWith("/settings")
    ) {
      redirect("/vendor-portal");
    }
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
              <Sidebar variant={effectiveRole} user={user} orgName={orgName} />
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
          <TaskSidePanelHost />
        </UserRoleProvider>
      </SidebarProvider>
    </SWRProvider>
  );
}
