"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { features } from "@/config/features";

interface Props {
  children: React.ReactNode;
}

/**
 * Element Library + Rate Contracts share a top-level tab strip. Each child
 * route renders independently; this layout only owns the tab navigation so
 * the highlighted tab survives across navigations without re-mount.
 */
export default function ElementsLayout({ children }: Props) {
  const t = useTranslations("elements");
  const tRc = useTranslations("rateContracts");
  const pathname = usePathname();

  const tabs: { href: string; label: string; show: boolean }[] = [
    {
      href: "/elements/library",
      label: t("tabLibrary"),
      show: true,
    },
    {
      href: "/elements/rate-contracts",
      label: tRc("tabRateContracts"),
      show: features.rateContracts,
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.show);

  return (
    <div className="flex flex-col gap-4">
      {visibleTabs.length > 1 && (
        <div className="border-b border-border-default">
          <nav className="flex gap-1 -mb-px">
            {visibleTabs.map((tab) => {
              const isActive =
                pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                    isActive
                      ? "border-accent text-text-primary"
                      : "border-transparent text-text-muted hover:text-text-primary hover:border-border-default"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      {children}
    </div>
  );
}
