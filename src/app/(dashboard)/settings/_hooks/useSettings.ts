"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/authClient";
import { toast } from "@/components/ui/useToast";
import { deriveInitials } from "@/lib/utils";
import { useAvatarUpload } from "@/hooks/useFileUpload";

/** Hook managing settings page state: profile, password, preferences, and account deletion. */
export function useSettings() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("pm");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
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
  const userId = session?.user?.id ?? "";

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
        password: deletePassword,
        callbackURL: "/login",
      });
      if (error) {
        const isSoleOwner = error.message?.includes("sole owner");
        toast({
          title: t("error"),
          description: isSoleOwner
            ? t("deleteErrorSoleOwner")
            : t("deleteError"),
          variant: "error",
        });
        setIsDeleting(false);
        return;
      }
      // Clear client-side session cache before redirecting so the login
      // page doesn't see a stale session and bounce back to dashboard.
      await authClient.signOut();
      setIsDeleting(false);
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
    userId,
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
    deletePassword,
    setDeletePassword,
    isDeleting,
    handleDeleteAccount,
  };
}
