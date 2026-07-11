"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  User,
  Lock,
  SlidersHorizontal,
  Building2,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useSettings } from "./_hooks/useSettings";
import { ProfileSection } from "./_components/ProfileSection";
import { PasswordSection } from "./_components/PasswordSection";
import { PreferencesSection } from "./_components/PreferencesSection";
import { DangerZoneSection } from "./_components/DangerZoneSection";
import { OrganizationSection } from "./_components/OrganizationSection";

type SectionId =
  | "profile"
  | "security"
  | "preferences"
  | "organization"
  | "danger";

/** Sectioned user settings — vertical nav, section chosen via `?section=`. */
export default function SettingsPage() {
  // useSearchParams needs a Suspense boundary to satisfy the App Router.
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const t = useTranslations("settings");
  const settings = useSettings();
  const { role } = useUserRole();
  const isClient = role === "client";
  const isPM = role === "pm";
  const searchParams = useSearchParams();

  // In-page sections, gated by role.
  type NavEntry = {
    id: SectionId;
    label: string;
    icon: LucideIcon;
    danger?: boolean;
  };
  const navItems: NavEntry[] = [
    { id: "profile", label: t("nav.profile"), icon: User },
  ];
  if (!isClient)
    navItems.push({ id: "security", label: t("nav.security"), icon: Lock });
  navItems.push({
    id: "preferences",
    label: t("nav.preferences"),
    icon: SlidersHorizontal,
  });
  if (isPM)
    navItems.push({
      id: "organization",
      label: t("nav.organization"),
      icon: Building2,
    });
  navItems.push({
    id: "danger",
    label: t("nav.danger"),
    icon: Trash2,
    danger: true,
  });

  const requested = searchParams.get("section") as SectionId | null;
  const active: SectionId =
    navItems.find((s) => s.id === requested)?.id ?? "profile";

  function renderSection() {
    switch (active) {
      case "profile":
        return (
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
        );
      case "security":
        return (
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
        );
      case "preferences":
        return <PreferencesSection />;
      case "organization":
        return <OrganizationSection />;
      case "danger":
        return (
          <DangerZoneSection
            deleteOpen={settings.deleteOpen}
            setDeleteOpen={settings.setDeleteOpen}
            deletePassword={settings.deletePassword}
            setDeletePassword={settings.setDeletePassword}
            isDeleting={settings.isDeleting}
            handleDeleteAccount={settings.handleDeleteAccount}
          />
        );
    }
  }

  function renderNavLink(s: NavEntry) {
    const Icon = s.icon;
    const isActive = s.id === active;
    return (
      <Link
        key={s.id}
        href={`/settings?section=${s.id}`}
        scroll={false}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-bg-elevated text-text-primary font-medium"
            : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
          s.danger && !isActive && "text-error/80 hover:text-error"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {s.label}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        {/* Vertical section nav */}
        <nav className="flex flex-col gap-1">{navItems.map(renderNavLink)}</nav>

        {/* Active section — keyed on the tab so it re-fades on switch. */}
        <div
          key={active}
          className="min-w-0 max-w-[700px] animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
        >
          {settings.loading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : (
            renderSection()
          )}
        </div>
      </div>
    </div>
  );
}
