import { Suspense } from "react";
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
import { getMemberRole } from "@/lib/queries";
import { getServerSession } from "@/lib/serverSession";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InvitationBanner } from "@/components/layout/InvitationBanner";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { PostHogIdentify } from "@/components/providers/PostHogIdentify";
import { TaskSidePanelHost } from "@/components/tasks/TaskSidePanelHost";
import type { User } from "@/types";

/**
 * Top-level routes a vendor may reach; anything else (studio surfaces)
 * redirects them to /dashboard. Their feature pages (/rfqs, /purchase-orders,
 * …) live under the `(vendor)` route group, which additionally gates on the
 * vendor role + `vendorPortal` flag.
 *
 * When adding/removing a vendor route, keep three things in sync: this list,
 * the `(vendor)` folder, and the vendor nav (`sidebar.tsx` vendorNav /
 * MobileBottomNav).
 */
const VENDOR_ALLOWED_ROUTES = [
  "/dashboard",
  "/rfqs",
  "/purchase-orders",
  "/invoices",
  "/progress",
  "/profile",
  "/settings",
  "/tasks",
];

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
  const session = await getServerSession();

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

  const [effectiveRole, orgRole, fullOrg] = await Promise.all([
    deriveEffectiveRole(session.user.id, orgId, session.user.role),
    orgId ? getMemberRole(orgId, session.user.id) : Promise.resolve(null),
    orgId && !orgName
      ? auth.api.getFullOrganization({
          headers: reqHeaders,
          query: { organizationId: orgId },
        })
      : null,
  ]);
  if (fullOrg) orgName = fullOrg.name ?? null;

  // Keep vendors in their lane: /dashboard (role-routed to the vendor
  // dashboard), their feature pages, /settings, and /tasks (shared task
  // system). Anything else redirects home. Exact-or-subpath match so a
  // future /settings-admin etc. isn't silently vendor-accessible.
  if (effectiveRole === "vendor") {
    const pathname = reqHeaders.get("x-pathname") ?? "";
    const allowed = VENDOR_ALLOWED_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`)
    );
    if (!allowed) redirect("/dashboard");
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
        <UserRoleProvider
          role={effectiveRole}
          userId={user.id}
          orgRole={orgRole}
        >
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

              <main className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] p-4 pb-[var(--mobile-nav-h,5rem)] lg:p-8 lg:pr-20 lg:pb-8">
                <div className="fixed top-4 right-4 lg:right-8 z-50 hidden lg:block">
                  <NotificationPanel />
                </div>
                <InvitationBanner />
                <ErrorBoundary>{children}</ErrorBoundary>
              </main>
            </div>
          </div>
          {/* Suspense boundary so `useSearchParams()` inside the host doesn't
           * opt every dashboard route out of static prerendering. */}
          <Suspense fallback={null}>
            <TaskSidePanelHost />
          </Suspense>
        </UserRoleProvider>
      </SidebarProvider>
    </SWRProvider>
  );
}
