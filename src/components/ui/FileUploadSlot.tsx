"use client";

import { useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFileUpload } from "@/hooks/useFileUpload";
import { toast } from "@/components/ui/useToast";
import { UPLOAD_ACCEPTED_TYPES } from "@/lib/fileUtils";

interface BaseProps {
  /** Free-form label rendered above the slot. */
  label?: string;
  /** Currently-stored URL. Pass `null` for empty state. */
  url: string | null;
  /** Original filename (for `file` variant). */
  fileName?: string | null;
  /** Called once an upload succeeds. */
  onUploaded: (next: { url: string; fileName: string }) => void;
  /** Called when the user clears the slot. */
  onCleared: () => void;
  /** Restrict the file picker `accept`. */
  accept?: string;
  /** Extra class on the outer wrapper. */
  className?: string;
}

interface ImageSlotProps extends BaseProps {
  variant: "image";
  /** Square slot size in px. Default 96. */
  size?: number;
}

interface FileSlotProps extends BaseProps {
  variant: "file";
}

type Props = ImageSlotProps | FileSlotProps;

/**
 * Generic upload slot used by element image + drawing + spec uploaders.
 *
 * Empty state: dashed-border drop zone with an upload icon.
 * Filled state: thumbnail (image variant) or file pill (file variant)
 * with a small clear (×) button.
 */
export function FileUploadSlot(props: Props) {
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploading, uploadAndAttach } = useFileUpload();

  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      await uploadAndAttach(file, async (result) => {
        props.onUploaded(result);
      });
    } catch (err) {
      // Surface the failure — a rejected file type, size cap, or network
      // error otherwise fails silently and the slot just resets to empty.
      toast({
        title: t("uploadFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  };

  const onPick = () => inputRef.current?.click();
  const accept =
    props.accept ??
    (props.variant === "image" ? "image/*" : UPLOAD_ACCEPTED_TYPES);
  const size = props.variant === "image" ? (props.size ?? 96) : 0;

  return (
    <div className={cn("flex flex-col gap-1.5", props.className)}>
      {props.label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {props.label}
        </label>
      )}

      {props.variant === "image" ? (
        <>
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-default bg-bg-input transition-colors hover:border-accent"
            style={{ width: size, height: size }}
          >
            {props.url ? (
              <>
                <Image
                  src={props.url}
                  alt=""
                  width={size}
                  height={size}
                  className="object-cover"
                  style={{ width: size, height: size }}
                  unoptimized
                />
                <button
                  type="button"
                  onClick={props.onCleared}
                  aria-label={t("delete")}
                  className="absolute right-1 top-1 rounded-full bg-bg-primary/90 p-1 text-text-muted hover:text-error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onPick}
                disabled={uploading}
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-muted hover:text-accent disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">{t("upload")}</span>
                  </>
                )}
              </button>
            )}
          </div>
          {props.url && (
            <button
              type="button"
              onClick={onPick}
              disabled={uploading}
              className="self-start text-[11px] text-text-muted hover:text-accent disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                t("replace")
              )}
            </button>
          )}
        </>
      ) : props.url ? (
        <div className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-text-muted" />
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate text-text-primary hover:text-accent"
          >
            {props.fileName ?? props.url}
          </a>
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="text-[11px] text-text-muted hover:text-accent disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              t("replace")
            )}
          </button>
          <button
            type="button"
            onClick={props.onCleared}
            aria-label={t("delete")}
            className="text-text-muted hover:text-error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-default bg-bg-input px-3 py-3 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>{t("upload")}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </div>
  );
}
