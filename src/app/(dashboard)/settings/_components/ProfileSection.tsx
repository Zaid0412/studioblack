"use client";

import { useTranslations } from "next-intl";
import { AlertCircle, Camera, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { avatarColor } from "@/lib/avatarUtils";
import { Separator } from "@/components/ui/separator";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProfileSectionProps {
  name: string;
  setName: (value: string) => void;
  email: string;
  userId: string;
  initials: string;
  avatarUrl: string | undefined;
  isSaving: boolean;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSave: () => void;
  openFilePicker: () => void;
  newEmail: string;
  setNewEmail: (value: string) => void;
  isChangingEmail: boolean;
  emailChangeRequested: boolean;
  emailChangeError: string;
  emailResendCooldown: number;
  handleChangeEmail: () => void;
}

/** Profile editing section with avatar, name, and email fields. */
export function ProfileSection(props: ProfileSectionProps) {
  const {
    name,
    setName,
    email,
    userId,
    initials,
    avatarUrl,
    isSaving,
    isUploading,
    fileInputRef,
    handleAvatarChange,
    handleSave,
    openFilePicker,
    newEmail,
    setNewEmail,
    isChangingEmail,
    emailChangeRequested,
    emailChangeError,
    emailResendCooldown,
    handleChangeEmail,
  } = props;
  const t = useTranslations("settings");

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <h3 className="text-base font-semibold text-text-primary">
          {t("profile")}
        </h3>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleAvatarChange}
        />

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className={isUploading ? "opacity-50" : ""}>
              <Avatar
                initials={initials}
                size="xl"
                src={avatarUrl}
                color={avatarColor(userId)}
              />
            </div>
            <button
              onClick={openFilePicker}
              disabled={isUploading}
              className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 rounded-full bg-bg-elevated border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-medium text-text-primary truncate">
              {name}
            </span>
            <button
              onClick={openFilePicker}
              disabled={isUploading}
              className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer text-left"
            >
              {isUploading ? t("uploading") : t("changeAvatar")}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label={t("fullName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          {/* Current email display */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              {t("email")}
            </label>
            <p className="text-sm text-text-secondary">{email}</p>
          </div>

          {/* Change email input */}
          {emailChangeRequested ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <p className="text-sm text-text-secondary">
                  {t("changeEmailSentTo", { email: newEmail })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleChangeEmail}
                disabled={isChangingEmail || emailResendCooldown > 0}
                className="text-xs text-text-muted hover:text-accent transition-colors self-start cursor-pointer disabled:opacity-50"
              >
                {isChangingEmail
                  ? t("sending")
                  : emailResendCooldown > 0
                    ? t("resendIn", { seconds: emailResendCooldown })
                    : t("resendEmail")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    label={t("newEmail")}
                    type="email"
                    placeholder={t("newEmailPlaceholder")}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <Button
                  variant="secondary"
                  className="self-end shrink-0"
                  onClick={handleChangeEmail}
                  disabled={
                    isChangingEmail ||
                    !newEmail ||
                    newEmail === email ||
                    !EMAIL_REGEX.test(newEmail)
                  }
                >
                  {isChangingEmail ? t("sending") : t("changeEmail")}
                </Button>
              </div>
              {emailChangeError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-error/10 border border-error/20">
                  <AlertCircle className="w-4 h-4 text-error shrink-0" />
                  <p className="text-sm text-error">{emailChangeError}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        <Button className="self-start" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("saving") : t("saveProfile")}
        </Button>
      </div>
    </Card>
  );
}
