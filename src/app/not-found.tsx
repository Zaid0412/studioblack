import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { branding } from "@/config/branding";

/** 404 page shown when no route matches. */
export default async function NotFound() {
  const t = await getTranslations("common");

  return (
    <div className="stagger-children flex min-h-dvh flex-col items-center justify-center bg-bg-primary px-4 text-center">
      {/* Light mode logo (default) — hidden when dark */}
      <Image
        src={branding.logoUrlDark ?? branding.logoUrl}
        alt={branding.appName}
        width={160}
        height={160}
        className="mb-1 h-40 w-40 object-contain not-found-logo-light"
      />
      {/* Dark mode logo — hidden by default, shown when dark */}
      <Image
        src={branding.logoUrl}
        alt={branding.appName}
        width={160}
        height={160}
        className="mb-1 h-40 w-40 object-contain not-found-logo-dark"
      />

      <h1
        className="text-[120px] font-extrabold leading-none tracking-tight text-text-primary"
        style={{ "--an-delay": "90ms" } as React.CSSProperties}
      >
        404
      </h1>

      <p
        className="mt-2 text-lg font-medium text-text-primary"
        style={{ "--an-delay": "160ms" } as React.CSSProperties}
      >
        {t("pageNotFound")}
      </p>

      <p
        className="mt-2 max-w-md text-sm text-text-muted"
        style={{ "--an-delay": "220ms" } as React.CSSProperties}
      >
        {t("pageNotFoundDescription")}
      </p>

      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        style={{ "--an-delay": "320ms" } as React.CSSProperties}
      >
        {t("backToDashboard")}
      </Link>
    </div>
  );
}
