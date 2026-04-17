"use client";

import { useTranslations } from "next-intl";

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
      <button
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t("tryAgain")}
      </button>
    </div>
  );
}
