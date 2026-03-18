import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { deriveInitials } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
  if (me?.role === "member") return "architect";
  return (fallbackRole as "pm" | "architect") ?? "pm";
}

/**
 * Dashboard layout — protected, PM and architect only.
 *
 * Performs full session validation via `auth.api.getSession()` (DB lookup).
 * Redirects unauthenticated users to `/login` and clients to `/client-dashboard`.
 * Auto-sets active organization if the user belongs to one but hasn't selected it.
 * Derives effective role from org membership (owner/admin → PM, member → architect).
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
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          variant={user.role === "pm" ? "pm" : "architect"}
          user={user}
        />
        <main className="flex-1 min-h-0 overflow-y-auto p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </SidebarProvider>
  );
}
