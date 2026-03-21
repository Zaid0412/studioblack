"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/useToast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useLocale } from "next-intl";
import { authClient } from "@/lib/authClient";
import { setLocale } from "@/lib/locale";
import { deriveInitials } from "@/lib/utils";
import { avatarColor } from "@/lib/avatarUtils";
import { useTheme } from "@/components/ThemeProvider";
import { useAvatarUpload } from "@/hooks/useFileUpload";

/** Client settings — profile, preferences, and theme. No password section (magic link auth). */
export default function ClientSettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { mode, toggleTheme } = useTheme();
  const currentLocale = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setAvatarUrl(session.user.image ?? undefined);
    }
  }, [session?.user?.name, session?.user?.image, session?.user]);

  const initials = deriveInitials(name);
  const email = session?.user?.email ?? "";

  const saveImage = useCallback(async (url: string) => {
    await authClient.updateUser({ image: url });
    setAvatarUrl(url);
  }, []);

  const onAvatarSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const { isUploading, handleAvatarChange } = useAvatarUpload({
    t,
    toast,
    saveImage,
    onSuccess: onAvatarSuccess,
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authClient.updateUser({ name });
      router.refresh();
      toast({
        title: t("savedToast"),
        description: t("savedDescription"),
        variant: "success",
      });
    } catch {
      toast({
        title: t("error"),
        description: t("saveProfileError"),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  return (
    <div className="flex flex-col gap-6 max-w-[700px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Profile section */}
      <Card>
        <div className="flex flex-col gap-6">
          <h3 className="text-base font-semibold text-text-primary">
            {t("profile")}
          </h3>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className={isUploading ? "opacity-50" : ""}>
                <Avatar
                  initials={initials}
                  size="xl"
                  src={avatarUrl}
                  color={avatarColor(session?.user?.id || "")}
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
            />
            <Input
              label={t("email")}
              type="email"
              value={email}
              disabled
              className="cursor-not-allowed"
            />
          </div>

          <Separator />

          <Button
            className="self-start"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? t("saving") : t("saveProfile")}
          </Button>
        </div>
      </Card>

      {/* Preferences */}
      <Card>
        <div className="flex flex-col gap-5">
          <h3 className="text-base font-semibold text-text-primary">
            {t("preferences")}
          </h3>

          <ToggleSwitch
            label={t("emailNotifications")}
            description={t("emailNotificationsDesc")}
            checked={emailNotif}
            onChange={setEmailNotif}
          />
          <ToggleSwitch
            label={t("pushNotifications")}
            description={t("pushNotificationsDesc")}
            checked={pushNotif}
            onChange={setPushNotif}
          />
          <ToggleSwitch
            label={t("darkMode")}
            description={t("darkModeDesc")}
            checked={mode === "dark"}
            onChange={() => toggleTheme()}
          />

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary">
                {t("language")}
              </span>
              <span className="text-xs text-text-muted">
                {t("languageDesc")}
              </span>
            </div>
            <Select
              value={currentLocale}
              onValueChange={async (value) => {
                await setLocale(value);
                window.location.reload();
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="tr">Türkçe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}
