"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ElementCategoryNode } from "@/types";

interface Props {
  open: boolean;
  target: ElementCategoryNode | null;
  /** Total direct-element count across the target's entire subtree. */
  subtreeElementCount: number;
  /** True when the subtree is still referenced by live data (elements or other). */
  subtreeReferenced: boolean;
  /** Number of nested sub-categories + service areas that will be deleted too. */
  descendantCount: number;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Blocks deletion with an explanatory error when the category (or any
 * descendant) is still referenced by live data. Once the subtree is clear,
 * deleting cascades to every nested sub-category and service area, so the
 * confirm spells out how many nested items go with it.
 */
export function DeleteConfirmDialog({
  open,
  target,
  subtreeElementCount,
  subtreeReferenced,
  descendantCount,
  submitting,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  // Blocked only when something in the subtree is still referenced. Prefer the
  // element message (the common, actionable case) and fall back to the generic
  // "referenced elsewhere" copy when it's BOQ/vendor/rate-contract data.
  const blockedByElements = subtreeReferenced && subtreeElementCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {subtreeReferenced
              ? t("categoryDeleteBlockedTitle")
              : target?.level === 2
                ? t("subcategoryDeleteConfirm")
                : target?.level === 3
                  ? t("serviceAreaDeleteConfirm")
                  : t("categoryDeleteConfirm")}
          </DialogTitle>
          <DialogDescription>
            {subtreeReferenced ? (
              <span className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  {blockedByElements
                    ? t("categoryDeleteBlocked", {
                        name: target?.name ?? "",
                        count: subtreeElementCount,
                      })
                    : t("categoryDeleteBlockedRef", {
                        name: target?.name ?? "",
                      })}
                </span>
              </span>
            ) : descendantCount > 0 ? (
              t("categoryDeleteCascade", {
                name: target?.name ?? "",
                count: descendantCount,
              })
            ) : (
              t("categoryDeletePermanent", { name: target?.name ?? "" })
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {tCommon("cancel")}
            </Button>
          </DialogClose>
          {!subtreeReferenced && (
            <Button
              type="button"
              variant="danger"
              onClick={onConfirm}
              disabled={submitting}
            >
              {submitting ? tCommon("loading") : tCommon("delete")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
