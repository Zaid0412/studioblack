"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: string;
  setInviteRole: (v: string) => void;
  isInviting: boolean;
  onInvite: () => void;
}

/** Dialog for inviting a member to the organisation by email and role. */
export function InviteDialog({
  open,
  onOpenChange,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  isInviting,
  onInvite,
}: InviteDialogProps) {
  const t = useTranslations("organisation");
  const tc = useTranslations("common");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setInviteEmail("");
          setInviteRole("member");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("inviteTitle")}</DialogTitle>
          <DialogDescription>{t("inviteDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <Input
            label={t("inviteEmail")}
            type="email"
            placeholder={t("inviteEmailPlaceholder")}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoComplete="email"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              {t("inviteRoleLabel")}
            </label>
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{t("rolePM")}</SelectItem>
                <SelectItem value="member">{t("roleArchitect")}</SelectItem>
                <SelectItem value="client">{t("roleClient")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isInviting}
          >
            {tc("cancel")}
          </Button>
          <Button
            onClick={onInvite}
            disabled={
              isInviting ||
              !inviteEmail.trim() ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())
            }
          >
            {isInviting ? t("sending") : t("sendInvite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
