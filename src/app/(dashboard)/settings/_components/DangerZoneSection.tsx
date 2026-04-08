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

interface DangerZoneSectionProps {
  deleteOpen: boolean;
  setDeleteOpen: (value: boolean) => void;
  deleteConfirm: string;
  setDeleteConfirm: (value: string) => void;
  deletePassword: string;
  setDeletePassword: (value: string) => void;
  isDeleting: boolean;
  handleDeleteAccount: () => void;
}

/** Account deletion section with confirmation dialog. */
export function DangerZoneSection({
  deleteOpen,
  setDeleteOpen,
  deleteConfirm,
  setDeleteConfirm,
  deletePassword,
  setDeletePassword,
  isDeleting,
  handleDeleteAccount,
}: DangerZoneSectionProps) {
  const t = useTranslations("settings");

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
            setDeleteConfirm("");
            setDeletePassword("");
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
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={t("deleteConfirmWord")}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                {t("currentPassword")}
              </label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirm("");
                setDeletePassword("");
              }}
              disabled={isDeleting}
            >
              {t("cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger-hover text-white"
              onClick={handleDeleteAccount}
              disabled={
                deleteConfirm !== t("deleteConfirmWord") ||
                !deletePassword ||
                isDeleting
              }
            >
              {isDeleting ? t("deleting") : t("deleteForever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
