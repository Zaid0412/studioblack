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
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Blocks deletion with an explanatory error when the category (or any
 * descendant) still has elements attached. Otherwise offers a destructive
 * confirm button.
 */
export function DeleteConfirmDialog({
  open,
  target,
  subtreeElementCount,
  submitting,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");
  // Surface both block reasons up front so the user isn't hit with a server
  // error after confirming: a node with sub-categories can't be deleted, and
  // neither can one whose subtree still has elements attached.
  const childCount = target?.children.length ?? 0;
  const blockedByChildren = childCount > 0;
  const blockedByElements = !blockedByChildren && subtreeElementCount > 0;
  const blocked = blockedByChildren || blockedByElements;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {blocked
              ? t("categoryDeleteBlockedTitle")
              : target?.level === 2
                ? t("subcategoryDeleteConfirm")
                : target?.level === 3
                  ? t("serviceAreaDeleteConfirm")
                  : t("categoryDeleteConfirm")}
          </DialogTitle>
          <DialogDescription>
            {blocked ? (
              <span className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  {blockedByChildren
                    ? t("categoryDeleteHasChildren", {
                        name: target?.name ?? "",
                        count: childCount,
                      })
                    : t("categoryDeleteBlocked", {
                        name: target?.name ?? "",
                        count: subtreeElementCount,
                      })}
                </span>
              </span>
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
          {!blocked && (
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
