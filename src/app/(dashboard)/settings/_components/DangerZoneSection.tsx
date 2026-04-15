"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface DangerZoneSectionProps {
  deleteOpen: boolean;
  setDeleteOpen: (value: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (value: string) => void;
  isDeleting: boolean;
  handleDeleteAccount: () => void;
}

/** Account deletion section with "type DELETE" confirmation dialog. */
export function DangerZoneSection(props: DangerZoneSectionProps) {
  const {
    deleteOpen,
    setDeleteOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    isDeleting,
    handleDeleteAccount,
  } = props;
  const t = useTranslations("settings");
  const confirmWord = t("deleteConfirmWord");

  return (
    <>
      {/* Danger zone */}
      <div className="rounded-xl border border-danger-border bg-danger-muted p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-danger" />
            <h3 className="text-base font-semibold text-danger">
              {t("deleteAccount")}
            </h3>
          </div>
          <p className="text-sm text-text-muted">{t("deleteAccountDesc")}</p>
          <Separator className="bg-danger-border" />
          <Button
            className="self-start bg-danger hover:bg-danger-hover text-white"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("deleteAccount")}
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-danger">
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                {t("typeDelete")}
              </label>
              <Input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={confirmWord}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting}
            >
              {t("cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger-hover text-white"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== confirmWord || isDeleting}
            >
              {isDeleting ? t("deleting") : t("deleteForever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
