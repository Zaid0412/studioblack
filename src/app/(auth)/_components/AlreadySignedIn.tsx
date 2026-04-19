import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

/** Shown when an authenticated user visits an auth page — displays a redirect message. */
export function AlreadySignedIn() {
  const t = useTranslations("auth");

  return (
    <div className="flex flex-col items-center text-center gap-4 py-8">
      <h2 className="text-2xl font-bold text-text-primary">
        {t("alreadySignedIn")}
      </h2>
      <p className="text-sm text-text-muted flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t("redirecting")}
      </p>
    </div>
  );
}
