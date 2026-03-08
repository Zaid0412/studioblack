"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { currentUser } from "@/data/mock";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <div className="flex flex-col gap-6 max-w-[700px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Profile section */}
      <Card>
        <div className="flex flex-col gap-6">
          <h3 className="text-base font-semibold text-text-primary">
            {t("profile")}
          </h3>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar initials={currentUser.initials} size="xl" />
              <button className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 rounded-full bg-bg-elevated border border-border-default text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text-primary">
                {currentUser.name}
              </span>
              <button className="text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer">
                {t("changeAvatar")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label={t("fullName")}
              defaultValue={currentUser.name}
            />
            <Input
              label={t("email")}
              type="email"
              defaultValue={currentUser.email}
            />
            <Input
              label={t("role")}
              defaultValue={
                currentUser.role.charAt(0).toUpperCase() +
                currentUser.role.slice(1)
              }
              disabled
            />
          </div>

          <Separator />

          <Button
            className="self-start"
            onClick={() =>
              toast({
                title: t("savedToast"),
                description: t("savedDescription"),
                variant: "success",
              })
            }
          >
            {t("saveProfile")}
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
            checked={darkMode}
            onChange={setDarkMode}
          />
        </div>
      </Card>
    </div>
  );
}
