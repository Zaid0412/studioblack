import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  const effectiveRole = await deriveEffectiveRole(
    session.user.id,
    session.session.activeOrganizationId ?? null,
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
