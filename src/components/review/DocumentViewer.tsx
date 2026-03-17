"use client";

import type { RefObject } from "react";
import { PDFViewer, type PDFViewerRef } from "@embedpdf/react-pdf-viewer";
import { Download, FileText } from "lucide-react";
import { isImage, isPdf } from "@/lib/fileUtils";
import { EMBEDPDF_THEME, DISABLED_CATEGORIES } from "@/lib/embedPdfConfig";

interface DocumentViewerProps {
  activeFileId: string;
  fileName: string;
  fileUrl: string;
  viewerRef: RefObject<PDFViewerRef | null>;
  /** Enable annotation tools (default: false — view-only). */
  annotations?: boolean;
}

/**
 *
 */
export function DocumentViewer({
  activeFileId,
  fileName,
  fileUrl,
  viewerRef,
  annotations = false,
}: DocumentViewerProps) {
  return (
    <div
      className={`flex-1 min-h-0 bg-[#1A1A1A] overflow-hidden ${isPdf(fileName) ? "relative" : "flex items-center justify-center"}`}
    >
      {isPdf(fileName) ? (
        <div className="absolute inset-0">
          <PDFViewer
            key={activeFileId}
            ref={viewerRef}
            style={{ width: "100%", height: "100%" }}
            config={{
              src: `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`,
              wasmUrl: "/pdfium.wasm",
              worker: false,
              theme: EMBEDPDF_THEME,
              tabBar: "never",
              disabledCategories: DISABLED_CATEGORIES,
              ...(annotations
                ? {
                    annotations: {
                      annotationAuthor: "StudioBlack User",
                      autoCommit: true,
                      selectAfterCreate: true,
                    },
                  }
                : {}),
              permissions: {
                enforceDocumentPermissions: false,
                overrides: {
                  print: true,
                  copyContents: true,
                  modifyAnnotations: annotations,
                },
              },
            }}
          />
        </div>
      ) : isImage(fileName) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={fileName}
          className="max-w-full max-h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <FileText className="w-16 h-16 text-[#666666]" />
          <p className="text-[#A0A0A0] text-sm">Preview not available</p>
          <a
            href={fileUrl}
            download
            className="inline-flex items-center gap-2 bg-[#F5C518] text-[#0D0D0D] rounded-lg px-4 py-2 text-sm font-semibold hover:bg-[#F5C518]/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      )}
    </div>
  );
}
