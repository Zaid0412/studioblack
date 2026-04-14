"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Card } from "@/components/ui/card";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useTheme } from "@/components/ThemeProvider";
import { setLocale } from "@/lib/locale";

/** User preferences section — theme, language, and notification placeholders. */
export function PreferencesSection() {
  const t = useTranslations("settings");
  const { mode, toggleTheme } = useTheme();
  const currentLocale = useLocale();

  // Placeholder notification state — not persisted yet
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);

  return (
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

        {/* Language selector */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-primary">
              {t("language")}
            </span>
            <span className="text-xs text-text-muted">{t("languageDesc")}</span>
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
  );
}
