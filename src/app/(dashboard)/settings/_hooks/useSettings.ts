"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { authClient } from "@/lib/authClient";
import { toast } from "@/components/ui/useToast";
import { deriveInitials } from "@/lib/utils";
import { useAvatarUpload } from "@/hooks/useFileUpload";
import { apiPost, apiGet, ApiError } from "@/lib/api/client";
import { API } from "@/lib/api/routes";

/** Hook managing settings page state: profile, password, preferences, and account deletion. */
export function useSettings() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch whether user has a credential (password) account
  const {
    data: passwordData,
    mutate: mutateHasPassword,
  } = useSWR<{ hasPassword: boolean }>(API.hasPassword());
  const hasPassword = passwordData?.hasPassword ?? true; // default to true until loaded

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("emailChangePendingEmail") ?? "";
  });
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeRequested, setEmailChangeRequested] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("emailChangeRequested") === "true";
  });
  const [emailChangeError, setEmailChangeError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // OTP state for passwordless users
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Sync form state when session loads
  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setAvatarUrl(session.user.image ?? undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only when specific fields change
  }, [session?.user?.name, session?.user?.image]);

  // Clear stale emailChangeRequested flag when session reloads.
  // If the user changed accounts (different user ID) or completed the change, clear the flag.
  useEffect(() => {
    if (!session?.user || !emailChangeRequested) return;
    const storedUserId = sessionStorage.getItem("emailChangeUserId");
    const pendingEmail = sessionStorage.getItem("emailChangePendingEmail");
    const currentEmail = session.user.email?.toLowerCase();
    // No user ID stored (legacy), different user, change completed, or no pending email
    if (
      !storedUserId ||
      storedUserId !== session.user.id ||
      !pendingEmail ||
      currentEmail === pendingEmail.toLowerCase()
    ) {
      setEmailChangeRequested(false);
      setNewEmail("");
      sessionStorage.removeItem("emailChangeRequested");
      sessionStorage.removeItem("emailChangePendingEmail");
      sessionStorage.removeItem("emailChangeUserId");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount with session
  }, [session?.user]);

  const loading = !session?.user;
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

  /** Send an OTP to the user's email for identity verification. */
  const sendOtp = async (purpose: "set_password" | "email_change") => {
    setIsSendingOtp(true);
    try {
      await apiPost(API.sendOtp(), { purpose });
      setOtpSent(true);
      setOtpCooldown(60);
      toast({
        title: t("otpSent"),
        description: t("otpSentDesc"),
        variant: "success",
      });
    } catch {
      toast({
        title: t("error"),
        description: t("otpSendError"),
        variant: "error",
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

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
      if (hasPassword) {
        // User has a password — use changePassword with current password
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
      } else {
        // Google-only user — verify OTP first, then set password
        if (!otpCode || otpCode.length !== 6) {
          toast({
            title: t("error"),
            description: t("otpRequired"),
            variant: "error",
          });
          return;
        }

        // Verify OTP first, then set password
        const otpResult = await apiPost<{ valid: boolean }>(
          "/api/settings/verify-otp",
          { otp: otpCode, purpose: "set_password" }
        );
        if (!otpResult.valid) {
          toast({
            title: t("error"),
            description: t("otpInvalid"),
            variant: "error",
          });
          return;
        }

        // Now set the password via custom API
        await apiPost("/api/settings/set-password", { newPassword });
        // Update hasPassword state
        mutateHasPassword({ hasPassword: true }, false);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setOtpCode("");
      setOtpSent(false);
      toast({
        title: hasPassword ? t("passwordChanged") : t("passwordSet"),
        description: hasPassword
          ? t("passwordChangedDesc")
          : t("passwordSetDesc"),
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

  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  // Email resend cooldown timer
  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setTimeout(
      () => setEmailResendCooldown((c) => c - 1),
      1000
    );
    return () => clearTimeout(timer);
  }, [emailResendCooldown]);

  const handleChangeEmail = async () => {
    if (!newEmail || newEmail === email) return;
    setIsChangingEmail(true);
    setEmailChangeError("");
    try {
      await apiPost(API.changeEmail(), { newEmail });
      setEmailChangeRequested(true);
      setEmailResendCooldown(60);
      sessionStorage.setItem("emailChangeRequested", "true");
      sessionStorage.setItem("emailChangePendingEmail", newEmail);
      if (session?.user?.id) {
        sessionStorage.setItem("emailChangeUserId", session.user.id);
      }
      toast({
        title: t("changeEmailSent"),
        description: t("changeEmailSentDesc"),
        variant: "success",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setEmailChangeError(err.message);
      } else {
        setEmailChangeError(t("changeEmailError"));
      }
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await authClient.deleteUser({
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
    loading,
    hasPassword,
    // Profile
    name,
    setName,
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
    // Email change
    newEmail,
    setNewEmail,
    isChangingEmail,
    emailChangeRequested,
    emailChangeError,
    emailResendCooldown,
    handleChangeEmail,
    // Password
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isChangingPassword,
    handleChangePassword,
    // OTP
    otpSent,
    otpCode,
    setOtpCode,
    isSendingOtp,
    otpCooldown,
    sendOtp,
    // Delete
    deleteOpen,
    setDeleteOpen,
    deleteConfirmText,
    setDeleteConfirmText,
    isDeleting,
    handleDeleteAccount,
  };
}
