import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/serverSession";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { deriveEffectiveRole } from "@/lib/effectiveRole";
import { VendorPortalComingSoon } from "@/components/vendor/VendorPortalComingSoon";

/**
 * Layout for the flattened vendor routes — /rfqs, /purchase-orders, /invoices,
 * /progress, /profile — grouped under `(vendor)` (the group name doesn't affect
 * the URL). Two gates:
 *
 *  1. Role — these are top-level URLs now, so a non-vendor could navigate here.
 *     Redirect them to /dashboard. (The `(dashboard)` layout keeps vendors *in*
 *     their lane; this keeps everyone else *out* — flattening loses the single
 *     `/vendor-portal` prefix that used to imply both.)
 *  2. Feature flag — when `vendorPortal` is off (production today), show the
 *     coming-soon panel instead of the unfinished portal, matching the
 *     /dashboard vendor gate. Write endpoints already 403 via
 *     `ensureVendorPortalEnabled`; this stops the pages from rendering at all.
 *
 * `getServerSession` / the membership read behind `deriveEffectiveRole` are
 * request-cached, so re-deriving the role here is a cache hit, not a new query.
 */
export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Match the (dashboard) layout's role derivation exactly. When there's no
  // active org yet, fall back to the user's first org so a member-role vendor
  // (e.g. a PM who accepted a vendor invite) resolves to "vendor" here too —
  // otherwise deriving with a null org would drop them to their db role and
  // wrongly bounce them off their own pages on first load. Skipped when the db
  // role is already "vendor" (deriveEffectiveRole short-circuits before org),
  // so normal vendors incur no extra lookup.
  let orgId = session.session.activeOrganizationId ?? null;
  if (!orgId && session.user.role !== "vendor") {
    const orgs = await auth.api.listOrganizations({ headers: await headers() });
    if (orgs && orgs.length > 0) orgId = orgs[0].id;
  }

  const effectiveRole = await deriveEffectiveRole(
    session.user.id,
    orgId,
    session.user.role
  );
  if (effectiveRole !== "vendor") redirect("/dashboard");

  const enabled = await getServerFeatureFlag(
    "vendorPortal",
    session.user.id,
    false
  );
  if (enabled) return <>{children}</>;

  const t = await getTranslations("vendorPortal");
  return (
    <VendorPortalComingSoon
      title={t("title")}
      comingSoon={t("comingSoon")}
      comingSoonHint={t("comingSoonHint")}
    />
  );
}
