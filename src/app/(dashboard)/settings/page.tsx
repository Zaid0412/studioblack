"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { deriveInitials } from "@/lib/utils";

/** User profile and preferences settings. */
export default function SettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("architect");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync form state when session loads
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setRole((session.user.role as string) ?? "architect");
      setAvatarUrl(session.user.image ?? undefined);
    }
  }, [session?.user?.name, session?.user?.role, session?.user?.image]);

  const initials = deriveInitials(name);
  const email = session?.user?.email ?? "";

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please use JPG, PNG, or WebP.",
        variant: "error",
      });
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum size is 1 MB.",
        variant: "error",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Upload failed");
      }

      const { url } = await res.json();

      // Save URL to user.image via better-auth
      await authClient.updateUser({ image: url });

      setAvatarUrl(url);
      // Refresh server components so sidebar picks up the new avatar
      router.refresh();

      toast({
        title: t("savedToast"),
        description: "Avatar updated.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not upload avatar.",
        variant: "error",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        title: "Error",
        description: "Could not save profile. Please try again.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await authClient.deleteUser({ password: deletePassword });
      router.push("/login");
    } catch {
      toast({
        title: "Error",
        description: t("deleteError"),
        variant: "error",
      });
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[700px]">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Profile section */}
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
                <Avatar initials={initials} size="xl" src={avatarUrl} />
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
                {isUploading ? "Uploading..." : t("changeAvatar")}
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
                  <SelectItem value="architect">Architect</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            checked={darkMode}
            onChange={setDarkMode}
          />
        </div>
      </Card>

      {/* Danger zone */}
      <div className="rounded-xl border border-danger-border bg-danger-muted p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-danger" />
            <h3 className="text-base font-semibold text-danger">
              {t("deleteAccount")}
            </h3>
          </div>
          <p className="text-sm text-text-muted">
            {t("deleteAccountDesc")}
          </p>
          <Separator className="bg-danger-border" />
          <Button
            className="self-start bg-danger hover:bg-danger-hover text-white"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("deleteAccount")}
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeleteConfirm("");
            setDeletePassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-danger">
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-primary">
                {t("typeDelete")}
              </label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
            <Input
              label={t("enterPassword")}
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setDeleteConfirm("");
                setDeletePassword("");
              }}
              disabled={isDeleting}
            >
              {t("cancel")}
            </Button>
            <Button
              className="bg-danger hover:bg-danger-hover text-white"
              onClick={handleDeleteAccount}
              disabled={
                deleteConfirm !== "DELETE" || !deletePassword || isDeleting
              }
            >
              {isDeleting ? t("deleting") : t("deleteForever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
