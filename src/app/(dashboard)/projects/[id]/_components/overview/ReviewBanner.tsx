"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Hourglass, ArrowRight } from "lucide-react";

interface ReviewBannerProps {
  count: number;
  /** Where "Review now" points — the Design tab. */
  href: string;
}

/** Client-only nudge: files awaiting the client's approval. Hidden when none. */
export function ReviewBanner({ count, href }: ReviewBannerProps) {
  const t = useTranslations("projectOverview");
  if (count <= 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-accent/25 bg-accent/10 px-5 py-4">
      <div className="flex items-center gap-3">
        <Hourglass
          className="h-5 w-5 shrink-0 text-accent"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-text-primary">
          {t("reviewBanner", { count })}
        </p>
      </div>
      <Link
        href={href}
        className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-text-on-accent hover:bg-accent-hover"
      >
        {t("reviewBannerCta")}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
