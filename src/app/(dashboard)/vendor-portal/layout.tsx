import { headers } from "next/headers";
import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  const enabled = session
    ? await getServerFeatureFlag("vendorPortal", session.user.id, false)
    : false;

  if (enabled) return <>{children}</>;

  const t = await getTranslations("vendorPortal");
  return (
    <div className="flex flex-col gap-6 max-w-[1100px]">
      <PageHeader title={t("title")} />
      <EmptyState
        icon={Clock}
        title={t("comingSoon")}
        description={t("comingSoonHint")}
      />
    </div>
  );
}
