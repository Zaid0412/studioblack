"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSettings } from "./_hooks/useSettings";
import { ProfileSection } from "./_components/ProfileSection";
import { PasswordSection } from "./_components/PasswordSection";
import { PreferencesSection } from "./_components/PreferencesSection";
import { DangerZoneSection } from "./_components/DangerZoneSection";
import { useUserRole } from "@/hooks/useUserRole";

/** User profile and preferences settings — adapts sections based on role. */
export default function SettingsPage() {
  const t = useTranslations("settings");
  const settings = useSettings();
  const { role } = useUserRole();
  const isClient = role === "client";

  return (
    <div className="flex flex-col gap-6 max-w-[700px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <ProfileSection
        name={settings.name}
        setName={settings.setName}
        role={settings.role}
        setRole={settings.setRole}
        email={settings.email}
        userId={settings.userId}
        initials={settings.initials}
        avatarUrl={settings.avatarUrl}
        isSaving={settings.isSaving}
        isUploading={settings.isUploading}
        fileInputRef={settings.fileInputRef}
        handleAvatarChange={settings.handleAvatarChange}
        handleSave={settings.handleSave}
        openFilePicker={settings.openFilePicker}
      />

      {!isClient && (
        <PasswordSection
          email={settings.email}
          currentPassword={settings.currentPassword}
          setCurrentPassword={settings.setCurrentPassword}
          newPassword={settings.newPassword}
          setNewPassword={settings.setNewPassword}
          confirmNewPassword={settings.confirmNewPassword}
          setConfirmNewPassword={settings.setConfirmNewPassword}
          isChangingPassword={settings.isChangingPassword}
          handleChangePassword={settings.handleChangePassword}
        />
      )}

      <PreferencesSection
        emailNotif={settings.emailNotif}
        setEmailNotif={settings.setEmailNotif}
        pushNotif={settings.pushNotif}
        setPushNotif={settings.setPushNotif}
      />

      {!isClient && (
        <DangerZoneSection
          deleteOpen={settings.deleteOpen}
          setDeleteOpen={settings.setDeleteOpen}
          deleteConfirm={settings.deleteConfirm}
          setDeleteConfirm={settings.setDeleteConfirm}
          deletePassword={settings.deletePassword}
          setDeletePassword={settings.setDeletePassword}
          isDeleting={settings.isDeleting}
          handleDeleteAccount={settings.handleDeleteAccount}
        />
      )}
    </div>
  );
}
