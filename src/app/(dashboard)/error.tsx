"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Dashboard-level error boundary — shown when an unhandled error occurs. */
export default function DashboardError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-lg font-semibold text-text-primary">
        {t("somethingWentWrong")}
      </h2>
      <Button onClick={reset} variant="primary" size="sm">
        {t("tryAgain")}
      </Button>
    </div>
  );
}
