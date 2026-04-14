"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface PasswordSectionProps {
  email: string;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (value: string) => void;
  isChangingPassword: boolean;
  handleChangePassword: () => void;
}

/** Password change form with current, new, and confirm fields. */
export function PasswordSection(props: PasswordSectionProps) {
  const {
    email,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isChangingPassword,
    handleChangePassword,
  } = props;
  const t = useTranslations("settings");

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-text-muted" />
            <h3 className="text-base font-semibold text-text-primary">
              {t("changePassword")}
            </h3>
          </div>
          <p className="text-sm text-text-muted">{t("changePasswordDesc")}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-4">
            <input
              type="email"
              value={email}
              autoComplete="username"
              readOnly
              hidden
            />
            <Input
              label={t("currentPassword")}
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <div>
              <Input
                label={t("newPassword")}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              {newPassword && newPassword.length < 8 && (
                <p className="text-xs text-red-400 mt-1">
                  {t("passwordTooShort")}
                </p>
              )}
            </div>
            <div>
              <Input
                label={t("confirmNewPassword")}
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              {confirmNewPassword && newPassword !== confirmNewPassword && (
                <p className="text-xs text-red-400 mt-1">
                  {t("passwordMismatch")}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <Button
            type="submit"
            className="self-start"
            disabled={
              !currentPassword ||
              !newPassword ||
              !confirmNewPassword ||
              isChangingPassword
            }
          >
            {isChangingPassword ? t("updatingPassword") : t("updatePassword")}
          </Button>
        </form>
      </div>
    </Card>
  );
}
