"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanManageCategories } from "@/hooks/useCanManageCategories";

/**
 * Secondary action button that links to the central `/categories` manager.
 * Shared by the Elements and Vendors page headers. Renders nothing unless the
 * user can manage the taxonomy (PM/architect + `elementLibrary`), mirroring the
 * page's own gate. Label collapses to an icon on small screens.
 */
export function ManageCategoriesButton() {
  const router = useRouter();
  const t = useTranslations("elements");
  const { canManage } = useCanManageCategories();

  if (!canManage) return null;

  return (
    <Button
      variant="secondary"
      onClick={() => router.push("/categories")}
      aria-label={t("manageCategories")}
    >
      <FolderTree className="w-4 h-4" />
      <span className="hidden sm:inline">{t("manageCategories")}</span>
    </Button>
  );
}
