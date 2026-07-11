import { Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Coming-soon panel shown when the `vendorPortal` flag is off. Presentational —
 * callers pass already-resolved strings so it works from both the server layout
 * (`getTranslations`) and the client dashboard (`useTranslations`). The flag
 * check itself can't be shared (server vs client), only this rendered panel.
 */
export function VendorPortalComingSoon({
  title,
  comingSoon,
  comingSoonHint,
}: {
  title: string;
  comingSoon: string;
  comingSoonHint: string;
}) {
  return (
    <div className="flex flex-col gap-6 max-w-[1100px]">
      <PageHeader title={title} />
      <EmptyState
        icon={Clock}
        title={comingSoon}
        description={comingSoonHint}
      />
    </div>
  );
}
