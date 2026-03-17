"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/components/ui/use-toast";
import { deriveInitials } from "@/lib/utils";

/**
 *
 */
export function useSettings() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("pm");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync form state when session loads
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setRole((session.user.role as string) ?? "pm");
      setAvatarUrl(session.user.image ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when specific fields change
  }, [session?.user?.name, session?.user?.role, session?.user?.image]);

  const initials = deriveInitials(name);
  const email = session?.user?.email ?? "";

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: t("invalidFileType"),
        description: t("invalidFileTypeDesc"),
        variant: "error",
      });
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast({
        title: t("fileTooLarge"),
        description: t("fileTooLargeDesc"),
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
        throw new Error(body.error || t("uploadFailed"));
      }

      const { url } = await res.json();

      // Save URL to user.image via better-auth
      await authClient.updateUser({ image: url });

      setAvatarUrl(url);
      // Refresh server components so sidebar picks up the new avatar
      router.refresh();

      toast({
        title: t("savedToast"),
        description: t("avatarUpdated"),
        variant: "success",
      });
    } catch {
      toast({
        title: t("error"),
        description: t("avatarUploadError"),
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
        title: t("error"),
        description: t("saveProfileError"),
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast({
        title: t("error"),
        description: t("passwordMismatch"),
        variant: "error",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: t("error"),
        description: t("passwordTooShort"),
        variant: "error",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) {
        toast({
          title: t("error"),
          description: t("passwordChangeError"),
          variant: "error",
        });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast({
        title: t("passwordChanged"),
        description: t("passwordChangedDesc"),
        variant: "success",
      });
    } catch {
      toast({
        title: t("error"),
        description: t("passwordChangeError"),
        variant: "error",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await authClient.deleteUser({
        callbackURL: "/login",
      });
      if (error) {
        toast({
          title: t("error"),
          description: t("deleteError"),
          variant: "error",
        });
        setIsDeleting(false);
        return;
      }
      router.push("/login");
    } catch {
      toast({
        title: t("error"),
        description: t("deleteError"),
        variant: "error",
      });
      setIsDeleting(false);
    }
  };

  return {
    // Profile
    name,
    setName,
    role,
    setRole,
    email,
    initials,
    avatarUrl,
    isSaving,
    isUploading,
    fileInputRef,
    handleAvatarChange,
    handleSave,
    openFilePicker,
    // Password
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isChangingPassword,
    handleChangePassword,
    // Notifications
    emailNotif,
    setEmailNotif,
    pushNotif,
    setPushNotif,
    // Delete
    deleteOpen,
    setDeleteOpen,
    deleteConfirm,
    setDeleteConfirm,
    isDeleting,
    handleDeleteAccount,
  };
}
