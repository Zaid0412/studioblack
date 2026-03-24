import { useState, useCallback } from "react";
import { upload } from "@/lib/api";

// ---------------------------------------------------------------------------
// Generic file upload hook
// ---------------------------------------------------------------------------

/**
 * Manages uploading state and the upload-then-attach pattern used across
 * the codebase. Callers provide an `attach` callback that receives the
 * upload result and performs whatever domain-specific persistence is needed.
 */
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndAttach = useCallback(
    async (
      file: File,
      attach: (result: { url: string; fileName: string }) => Promise<void>
    ) => {
      setUploading(true);
      setError(null);
      try {
        const result = await upload.uploadFile(file);
        await attach(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    []
  );

  return { uploading, error, setError, uploadAndAttach };
}

// ---------------------------------------------------------------------------
// Avatar upload hook — shared between admin and client settings
// ---------------------------------------------------------------------------

interface AvatarUploadDeps {
  /** Translation function (from next-intl useTranslations("settings")). */
  t: (key: string) => string;
  /** Call to show a toast notification. */
  toast: (opts: {
    title?: string;
    description?: string;
    variant?: "default" | "success" | "error" | "warning";
  }) => unknown;
  /** Persists the new avatar URL to the user record. */
  saveImage: (url: string) => Promise<void>;
  /** Called after a successful upload (e.g., router.refresh). */
  onSuccess?: () => void;
}

/** Handle avatar image upload with validation, toast feedback, and persistence. */
export function useAvatarUpload({
  t,
  toast,
  saveImage,
  onSuccess,
}: AvatarUploadDeps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const { url } = await upload.uploadAvatar(file);
        await saveImage(url);
        onSuccess?.();

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
        // Reset the input so the same file can be re-selected
        e.target.value = "";
      }
    },
    [t, toast, saveImage, onSuccess]
  );

  return { isUploading, handleAvatarChange };
}
