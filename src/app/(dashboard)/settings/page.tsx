"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, FolderTree } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/card";
import { useFeatureFlagEnabled } from "posthog-js/react";
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
  const elementLibraryEnabled = useFeatureFlagEnabled("elementLibrary") ?? true;

  if (settings.loading) {
    return (
      <div className="flex flex-col gap-6 max-w-[700px]">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        {/* Profile section skeleton */}
        <Card>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-5 w-16" />
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </Card>
        {/* Password section skeleton */}
        <Card>
          <div className="flex flex-col gap-6">
            <div>
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </Card>
        {/* Preferences section skeleton */}
        <Card>
          <div className="flex flex-col gap-5">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[700px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <ProfileSection
        name={settings.name}
        setName={settings.setName}
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
        newEmail={settings.newEmail}
        setNewEmail={settings.setNewEmail}
        isChangingEmail={settings.isChangingEmail}
        emailChangeRequested={settings.emailChangeRequested}
        emailChangeError={settings.emailChangeError}
        handleChangeEmail={settings.handleChangeEmail}
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

      <PreferencesSection />

      {!isClient && elementLibraryEnabled && (
        <Link
          href="/settings/element-categories"
          className="block rounded-xl border border-border-default bg-bg-secondary p-4 lg:p-5 transition-colors hover:border-border-light hover:bg-bg-elevated"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <FolderTree className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-text-primary">
                  {t("elementCategoriesTitle")}
                </span>
                <span className="text-[13px] text-text-muted">
                  {t("elementCategoriesDesc")}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
          </div>
        </Link>
      )}

      <DangerZoneSection
        deleteOpen={settings.deleteOpen}
        setDeleteOpen={settings.setDeleteOpen}
        deletePassword={settings.deletePassword}
        setDeletePassword={settings.setDeletePassword}
        isDeleting={settings.isDeleting}
        handleDeleteAccount={settings.handleDeleteAccount}
      />
    </div>
  );
}
