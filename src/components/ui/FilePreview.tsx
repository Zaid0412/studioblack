"use client";

import { useState, type ReactNode } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  MoreVertical,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/useToast";
import { isImage, isImageMime, isPdf, isPdfMime } from "@/lib/fileUtils";
import { cn } from "@/lib/utils";

type FilePreviewSize = "sm" | "md" | "lg";
export type FilePreviewAction =
  | "fullscreen"
  | "openInNewTab"
  | "copy"
  | "download";

/**
 * Internal-only — adds `minimize` which only the fullscreen overlay uses
 * (to exit back to the inline preview). Not part of the public action
 * union because it doesn't apply to the inline toolbar.
 */
type ToolbarAction = FilePreviewAction | "minimize";

const SIZE_HEIGHTS: Record<FilePreviewSize, number> = {
  sm: 200,
  md: 400,
  lg: 600,
};

const DEFAULT_ACTIONS: FilePreviewAction[] = [
  "fullscreen",
  "openInNewTab",
  "copy",
  "download",
];

const ACTION_LABELS: Record<ToolbarAction, string> = {
  fullscreen: "Fullscreen",
  minimize: "Exit fullscreen",
  openInNewTab: "Open in new tab",
  copy: "Copy",
  download: "Download",
};

const ACTION_ICONS: Record<
  ToolbarAction,
  React.ComponentType<{ className?: string }>
> = {
  fullscreen: Maximize2,
  minimize: Minimize2,
  openInNewTab: ExternalLink,
  copy: Copy,
  download: Download,
};

/**
 * Returns true when `FilePreview` would render an inline preview (image or
 * PDF) for this file. Use it to gate work that's only worthwhile when a
 * real preview is going to render — e.g. don't mint a signed download URL
 * for a `.docx` that's only going to show the "Not supported" card.
 */
export function isFilePreviewable(
  mimeType: string | undefined,
  fileName: string
): boolean {
  if (mimeType) return isImageMime(mimeType) || isPdfMime(mimeType);
  return isImage(fileName) || isPdf(fileName);
}

interface FilePreviewProps {
  /**
   * URL to fetch the file from. While undefined, the component renders a
   * spinner — callers that fetch a signed URL asynchronously don't need a
   * separate loading prop.
   */
  url: string | undefined;
  /** Used as `<img alt>`, the iframe `title`, the download filename, and the fallback subtitle. */
  fileName: string;
  /** Preferred over `fileName` for dispatch when present. */
  mimeType?: string;
  /** Height shorthand. Mapped to a pixel value; `maxHeight` wins when both are set. */
  size?: FilePreviewSize;
  /** Explicit height in px. Overrides `size`. */
  maxHeight?: number;
  /** Pass-through to the outer wrapper. */
  className?: string;
  /**
   * Override the default "Preview not supported" card. Useful for callers
   * that want to surface a specific CTA (e.g. "Open in external viewer").
   */
  fallback?: ReactNode;
  /**
   * Built-in toolbar actions. Default = all four. Pass `[]` to hide the
   * toolbar entirely. `fullscreen` is auto-skipped when the file type
   * can't render inline (no preview to enlarge).
   */
  actions?: FilePreviewAction[];
  /**
   * Optional async callback to mint a fresh URL right before an action
   * fires. Use when `url` is short-lived (e.g. signed URLs that may
   * expire while the user has the preview open). The fresh URL is also
   * used for the fullscreen overlay. Falls back to the inline `url`
   * on error.
   */
  refreshUrl?: () => Promise<string>;
}

/**
 * Lightweight inline preview for files. Renders:
 *   - `<img>` for `image/*` mimes (or image extensions when mime is absent)
 *   - `<iframe>` for `application/pdf` (or `.pdf`)
 *   - A "Preview not supported" card for everything else
 *
 * The hover-revealed toolbar on desktop (top-right pill of yellow icon
 * buttons with tooltips) collapses on mobile to a single kebab that opens
 * a labelled Popover — same actions, lower visual weight without hover.
 *
 * Heavier surfaces (the design-review tool, with pin-comments + canvas-based
 * PDF rendering) should keep using `src/components/review/DocumentViewer` —
 * this component intentionally stays zero-bundle-cost (no pdfjs).
 */
export function FilePreview({
  url,
  fileName,
  mimeType,
  size = "md",
  maxHeight,
  className,
  fallback,
  actions = DEFAULT_ACTIONS,
  refreshUrl,
}: FilePreviewProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string | undefined>(
    undefined
  );

  const height = maxHeight ?? SIZE_HEIGHTS[size];
  const wrapperClass = cn(
    "group relative rounded-lg border border-border-default bg-bg-elevated overflow-hidden",
    className
  );

  const isImageType = mimeType ? isImageMime(mimeType) : isImage(fileName);
  const isPdfType = mimeType ? isPdfMime(mimeType) : isPdf(fileName);
  const supported = isImageType || isPdfType;

  // Hide actions that don't make sense for this file:
  //   - `fullscreen`: nothing to enlarge when there's no inline preview
  const applicableActions = actions.filter((a) => {
    if (a === "fullscreen") return supported;
    return true;
  });

  async function runAction(action: ToolbarAction) {
    if (!url) return;
    // Mint a fresh URL right before consuming it — the inline preview's
    // URL may be stale (long-open sheets). Falls back to the cached URL
    // on error so the action still has a chance to succeed.
    const liveUrl = refreshUrl ? await refreshUrl().catch(() => url) : url;
    switch (action) {
      case "fullscreen":
        setFullscreenUrl(liveUrl);
        setFullscreenOpen(true);
        return;
      case "minimize":
        // Only fired from inside `FullscreenDialog`, which intercepts it
        // there. Defensive no-op for the inline toolbar.
        return;
      case "openInNewTab":
        window.open(liveUrl, "_blank", "noopener,noreferrer");
        return;
      case "copy":
        await copyFile({ url: liveUrl, fileName, isImageType });
        return;
      case "download":
        downloadFile({ url: liveUrl, fileName });
        return;
    }
  }

  function renderContent() {
    if (!supported) {
      if (fallback !== undefined) return <>{fallback}</>;
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
          )}
        >
          <FileText className="w-8 h-8 text-text-muted" />
          <span className="text-xs text-text-muted">
            Preview not supported for this file type.
          </span>
          <span className="text-xs text-text-secondary truncate max-w-full">
            {fileName}
          </span>
        </div>
      );
    }
    if (!url) {
      return (
        <div className="flex items-center justify-center" style={{ height }}>
          <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
        </div>
      );
    }
    if (isImageType) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={fileName}
          className="w-full object-contain bg-bg-primary"
          style={{ maxHeight: height }}
        />
      );
    }
    return (
      <iframe
        src={url}
        title={fileName}
        className="w-full bg-bg-primary"
        style={{ height }}
      />
    );
  }

  return (
    <>
      <div className={wrapperClass}>
        {renderContent()}
        {url && applicableActions.length > 0 && (
          <Toolbar actions={applicableActions} onAction={runAction} />
        )}
      </div>

      {supported && (
        <FullscreenDialog
          open={fullscreenOpen}
          onOpenChange={setFullscreenOpen}
          // Use the freshly-minted URL captured when the action fired,
          // falling back to the inline `url` so the dialog still works
          // if `refreshUrl` isn't provided.
          url={fullscreenUrl ?? url ?? ""}
          fileName={fileName}
          isImageType={isImageType}
          // Fullscreen view skips its own fullscreen button — already there.
          actions={applicableActions.filter((a) => a !== "fullscreen")}
          onAction={runAction}
        />
      )}
    </>
  );
}

function Toolbar({
  actions,
  onAction,
}: {
  actions: ToolbarAction[];
  onAction: (a: ToolbarAction) => void;
}) {
  return (
    <>
      {/* Desktop: hover-revealed row of small yellow icon buttons. Hidden < md. */}
      <div className="hidden md:flex absolute right-2 top-2 gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {actions.map((a) => {
          const Icon = ACTION_ICONS[a];
          return (
            <Tooltip key={a}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onAction(a)}
                  aria-label={ACTION_LABELS[a]}
                  className="flex h-6 w-6 items-center justify-center rounded bg-accent text-text-on-accent shadow-sm hover:brightness-110 transition cursor-pointer"
                >
                  <Icon className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{ACTION_LABELS[a]}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Mobile: single yellow kebab → Popover with labelled actions. Hidden ≥ md. */}
      <div className="md:hidden absolute right-2 top-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="File actions"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-text-on-accent shadow-md cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <div className="flex flex-col">
              {actions.map((a) => {
                const Icon = ACTION_ICONS[a];
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => onAction(a)}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-bg-elevated rounded-md text-left cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-accent" />
                    {ACTION_LABELS[a]}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}

function FullscreenDialog({
  open,
  onOpenChange,
  url,
  fileName,
  isImageType,
  actions,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  fileName: string;
  isImageType: boolean;
  actions: FilePreviewAction[];
  onAction: (a: FilePreviewAction) => void;
}) {
  // Inside the overlay the fullscreen button doesn't make sense — replace
  // it with a minimize button that closes the dialog.
  const overlayActions: ToolbarAction[] = ["minimize", ...actions];

  function handle(a: ToolbarAction) {
    if (a === "minimize") {
      onOpenChange(false);
      return;
    }
    onAction(a);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        Force the dialog into flex-column with no gap so the single child
        fills the dialog's content box on all four sides. The base
        DialogContent uses `grid` + `gap-4`, which leaves the inner div
        overflowing past the bottom border at this height.
      */}
      <DialogContent className="group !flex !flex-col gap-0 max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">{fileName}</DialogTitle>
        <div className="relative flex-1 min-h-0 bg-bg-primary">
          {isImageType ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={fileName}
              className="w-full h-full object-contain"
            />
          ) : (
            <iframe
              src={url}
              title={fileName}
              className="w-full h-full bg-bg-primary"
            />
          )}
          <Toolbar actions={overlayActions} onAction={handle} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Copy file to clipboard. For images we copy the actual pixels (converted
 * to PNG via canvas when the source isn't already PNG, since most browsers
 * only accept `image/png` via the Clipboard API). For PDFs and anything
 * else we copy the URL — the clipboard API doesn't accept those mimes.
 *
 * On any failure we fall back to URL-copy so the action always succeeds at
 * something. The toast describes what was actually copied.
 *
 * Performance note: the canvas conversion path runs synchronously on the
 * main thread. Acceptable because uploads are capped at `MAX_UPLOAD_SIZE`
 * (50MB) — a single decode + redraw fits comfortably under the
 * "long task" budget. Raise the cap or add streaming if that ever
 * changes.
 */
async function copyFile({
  url,
  fileName,
  isImageType,
}: {
  url: string;
  fileName: string;
  isImageType: boolean;
}) {
  if (isImageType) {
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const pngBlob =
        blob.type === "image/png" ? blob : await convertToPng(blob);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      toast({ title: "Image copied." });
      return;
    } catch {
      // fall through to URL copy
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast({
      title: isImageType
        ? "Couldn't copy image — link copied instead."
        : "Link copied.",
    });
  } catch {
    toast({ title: `Couldn't copy ${fileName}.`, variant: "error" });
  }
}

async function convertToPng(blob: Blob): Promise<Blob> {
  const objUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Image load failed"));
      i.src = objUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/png"
      );
    });
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

/**
 * Trigger a download via a direct anchor click — no fetch + blob round-trip,
 * so the file streams from Supabase to disk without ever sitting in browser
 * memory. We append `?download=<name>` to the URL so Supabase sets
 * `Content-Disposition: attachment` for that one request, which forces the
 * browser to save instead of navigate, even for cross-origin URLs where the
 * `<a download>` attribute alone is best-effort.
 */
function downloadFile({ url, fileName }: { url: string; fileName: string }) {
  const sep = url.includes("?") ? "&" : "?";
  const downloadUrl = `${url}${sep}download=${encodeURIComponent(fileName)}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
