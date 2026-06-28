"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings, ArrowUpRight } from "lucide-react";

interface Props {
  /** The page the user is on — drives the editor's back-link (`?from=…`). */
  from: "elements" | "vendors";
  /** Optional muted hint below the link (e.g. "Shared with the Elements library"). */
  hint?: string;
}

/**
 * Footer link from a category sidebar to the shared element-category editor.
 * Used by both the Elements library and the Vendors sidebars — same tree, one
 * editor. The `manageCategories` key is read from the caller's namespace.
 */
export function ManageCategoriesLink({ from, hint }: Props) {
  const t = useTranslations(from);
  return (
    <>
      <div className="my-3 h-px bg-border-default" />
      <Link
        href={`/settings/element-categories?from=${from}`}
        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[12px] text-accent hover:bg-accent/10 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5" />
          {t("manageCategories")}
        </span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
      {hint && (
        <span className="px-2 pt-1 text-[11px] text-text-muted">{hint}</span>
      )}
    </>
  );
}
