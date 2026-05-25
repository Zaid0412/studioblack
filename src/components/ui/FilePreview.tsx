"use client";

import { FileText, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { isImage, isImageMime, isPdf, isPdfMime } from "@/lib/fileUtils";
import { cn } from "@/lib/utils";

type FilePreviewSize = "sm" | "md" | "lg";

const SIZE_HEIGHTS: Record<FilePreviewSize, number> = {
  sm: 200,
  md: 400,
  lg: 600,
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
  /** Used as `<img alt>`, the iframe `title`, and the fallback subtitle. */
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
}

/**
 * Lightweight inline preview for files. Renders:
 *   - `<img>` for `image/*` mimes (or image extensions when mime is absent)
 *   - `<iframe>` for `application/pdf` (or `.pdf`)
 *   - A "Preview not supported" card for everything else
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
}: FilePreviewProps) {
  const height = maxHeight ?? SIZE_HEIGHTS[size];
  const wrapperClass = cn(
    "rounded-lg border border-border-default bg-bg-elevated overflow-hidden",
    className
  );

  // Dispatch on mime first (more reliable), then fall back to extension.
  const isImageType = mimeType ? isImageMime(mimeType) : isImage(fileName);
  const isPdfType = mimeType ? isPdfMime(mimeType) : isPdf(fileName);

  // Render the unsupported fallback even when `url` is missing — otherwise an
  // unsupported file with no URL yet would show a spinner that never resolves.
  if (!isImageType && !isPdfType) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <div
        className={cn(
          wrapperClass,
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
      <div
        className={cn(wrapperClass, "flex items-center justify-center")}
        style={{ height }}
      >
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  if (isImageType) {
    return (
      <div className={wrapperClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={fileName}
          className="w-full object-contain bg-bg-primary"
          style={{ maxHeight: height }}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <iframe
        src={url}
        title={fileName}
        className="w-full bg-bg-primary"
        style={{ height }}
      />
    </div>
  );
}
