"use client";

import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { avatarColor } from "@/lib/avatarUtils";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface ProfileSectionProps {
  name: string;
  setName: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
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
}

/** Profile editing section with avatar, name, role, and email fields. */
export function ProfileSection({
  name,
  setName,
  role,
  setRole,
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
}: ProfileSectionProps) {
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
          <Input
            label={t("email")}
            type="email"
            value={email}
            autoComplete="email"
            disabled
            className="cursor-not-allowed"
          />

          {/* Role dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-primary">
              {t("role")}
            </label>
            <Select value={role} onValueChange={setRole} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pm">Project Manager</SelectItem>
                <SelectItem value="architect">Architect</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <Button className="self-start" onClick={handleSave} disabled={isSaving}>
          {isSaving ? t("saving") : t("saveProfile")}
        </Button>
      </div>
    </Card>
  );
}
