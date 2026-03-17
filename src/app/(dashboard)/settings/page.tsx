"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { useSettings } from "./_hooks/use-settings";
import { ProfileSection } from "./_components/profile-section";
import { PasswordSection } from "./_components/password-section";
import { PreferencesSection } from "./_components/preferences-section";
import { DangerZoneSection } from "./_components/danger-zone-section";

/** User profile and preferences settings. */
export default function SettingsPage() {
  const t = useTranslations("settings");
  const settings = useSettings();

  return (
    <div className="flex flex-col gap-6 max-w-[700px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <ProfileSection
        name={settings.name}
        setName={settings.setName}
        role={settings.role}
        setRole={settings.setRole}
        email={settings.email}
        initials={settings.initials}
        avatarUrl={settings.avatarUrl}
        isSaving={settings.isSaving}
        isUploading={settings.isUploading}
        fileInputRef={settings.fileInputRef}
        handleAvatarChange={settings.handleAvatarChange}
        handleSave={settings.handleSave}
        openFilePicker={settings.openFilePicker}
      />

      <PasswordSection
        currentPassword={settings.currentPassword}
        setCurrentPassword={settings.setCurrentPassword}
        newPassword={settings.newPassword}
        setNewPassword={settings.setNewPassword}
        confirmNewPassword={settings.confirmNewPassword}
        setConfirmNewPassword={settings.setConfirmNewPassword}
        isChangingPassword={settings.isChangingPassword}
        handleChangePassword={settings.handleChangePassword}
      />

      <PreferencesSection
        emailNotif={settings.emailNotif}
        setEmailNotif={settings.setEmailNotif}
        pushNotif={settings.pushNotif}
        setPushNotif={settings.setPushNotif}
      />

      <DangerZoneSection
        deleteOpen={settings.deleteOpen}
        setDeleteOpen={settings.setDeleteOpen}
        deleteConfirm={settings.deleteConfirm}
        setDeleteConfirm={settings.setDeleteConfirm}
        isDeleting={settings.isDeleting}
        handleDeleteAccount={settings.handleDeleteAccount}
      />
    </div>
  );
}
