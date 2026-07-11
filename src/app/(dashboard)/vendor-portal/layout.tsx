import { getTranslations } from "next-intl/server";
import { getServerSession } from "@/lib/serverSession";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { VendorPortalComingSoon } from "@/components/vendor/VendorPortalComingSoon";

/**
 * Vendor portal layout — gates the entire `/vendor-portal/*` subtree on the
 * `vendorPortal` PostHog flag.
 *
 * When the flag is off (production today), any vendor user who slips in via
 * the email-match auto-promotion path in `databaseHooks.user.create.after`
 * sees a coming-soon panel instead of the broken portal (write endpoints
 * already 403 via `ensureVendorPortalEnabled`, so without this gate the
 * pages would render but every action would error).
 */
export default async function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  const enabled = session
    ? await getServerFeatureFlag("vendorPortal", session.user.id, false)
    : false;

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
