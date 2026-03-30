"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { isImage, isPdf } from "@/lib/fileUtils";

// Pin cursor as a data URI — encoded at module load time
const PIN_CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="22" viewBox="0 0 24 32" fill="none"><path d="M12 0C5.372 0 0 5.372 0 12c0 7 12 20 12 20s12-13 12-20c0-6.628-5.372-12-12-12z" fill="#F5C518"/><circle cx="12" cy="12" r="4" fill="#0D0D0D"/></svg>`;
const PIN_CURSOR = typeof window !== "undefined"
  ? `url("data:image/svg+xml;base64,${btoa(PIN_CURSOR_SVG)}") 8 22, crosshair`
  : "crosshair";

interface DocumentViewerProps {
  activeFileId: string;
  fileName: string;
  fileUrl: string;
  pinMode?: boolean;
  onPinClick?: (xPercent: number, yPercent: number, page: number) => void;
  /** Overlay rendered per PDF page (receives page number) or once for images. */
  renderPageOverlay?: (page: number) => ReactNode;
  children?: ReactNode;
}

/**
 * Renders a PDF (via pdfjs-dist loaded from CDN), image, or download fallback.
 * Pin mode allows clicking to place pin comments at percentage coordinates.
 */
export function DocumentViewer({
  activeFileId,
  fileName,
  fileUrl,
  pinMode = false,
  onPinClick,
  renderPageOverlay,
  children,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfjsRef = useRef<PdfjsLib | null>(null);
  const pdfDocRef = useRef<PdfDocument | null>(null);

  // Load pdfjs-dist from CDN once
  useEffect(() => {
    if (pdfjsRef.current) return;

    const script = document.createElement("script");
    script.src = "https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs";
    script.type = "module";

    // For module scripts we need a different loading strategy
    const moduleScript = document.createElement("script");
    moduleScript.type = "module";
    moduleScript.textContent = `
      import * as pdfjsLib from "https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs";
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs";
      window.__pdfjsLib = pdfjsLib;
      window.dispatchEvent(new Event("pdfjsReady"));
    `;
    document.head.appendChild(moduleScript);

    const onReady = () => {
      pdfjsRef.current = (window as WindowWithPdfjs).__pdfjsLib ?? null;
    };
    window.addEventListener("pdfjsReady", onReady);

    return () => {
      window.removeEventListener("pdfjsReady", onReady);
    };
  }, []);

  // Render PDF pages when file changes
  useEffect(() => {
    if (!isPdf(fileName)) return;

    let cancelled = false;
    const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`;

    async function loadPdf() {
      // Wait for pdfjs to be available
      let lib = pdfjsRef.current;
      if (!lib) {
        await new Promise<void>((resolve) => {
          const check = () => {
            lib = (window as WindowWithPdfjs).__pdfjsLib ?? null;
            if (lib) {
              pdfjsRef.current = lib;
              resolve();
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
        lib = pdfjsRef.current;
      }
      if (!lib || cancelled) return;

      setPdfLoading(true);
      try {
        const doc = await lib.getDocument(proxyUrl).promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);

        // Render will happen after state update via the render effect
      } catch (err) {
        console.error("[DocumentViewer] PDF load error:", err);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      pdfDocRef.current = null;
      setNumPages(0);
    };
  }, [activeFileId, fileName, fileUrl]);

  // Render individual pages onto canvases
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;
    let cancelled = false;

    async function renderPages() {
      const doc = pdfDocRef.current;
      if (!doc) return;

      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) return;
        const canvas = canvasRefs.current.get(i);
        if (!canvas) continue;

        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    }

    renderPages();
    return () => {
      cancelled = true;
    };
  }, [numPages]);

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, page: number) => {
      if (!pinMode || !onPinClick) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
      onPinClick(xPercent, yPercent, page);
    },
    [pinMode, onPinClick]
  );

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pinMode || !onPinClick) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
      onPinClick(xPercent, yPercent, 1);
    },
    [pinMode, onPinClick]
  );

  const setCanvasRef = useCallback(
    (page: number, el: HTMLCanvasElement | null) => {
      if (el) canvasRefs.current.set(page, el);
      else canvasRefs.current.delete(page);
    },
    []
  );

  return (
    <div
      className={`flex-1 min-h-0 bg-[#1A1A1A] overflow-hidden ${
        isPdf(fileName) ? "relative" : "flex items-center justify-center"
      }`}
    >
      {isPdf(fileName) ? (
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-auto"
          style={{ cursor: pinMode ? PIN_CURSOR : undefined }}
        >
          {pdfLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-[#F5C518]" />
            </div>
          )}
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              className="relative flex justify-center py-2"
              onClick={(e) => handlePageClick(e, pageNum)}
            >
              <div className="relative">
                <canvas
                  ref={(el) => setCanvasRef(pageNum, el)}
                  className="max-w-full"
                  style={{ width: "100%", height: "auto" }}
                />
                {renderPageOverlay?.(pageNum)}
              </div>
            </div>
          ))}
          {children}
        </div>
      ) : isImage(fileName) ? (
        <div
          className="relative max-w-full max-h-full"
          style={{ cursor: pinMode ? PIN_CURSOR : undefined }}
          onClick={handleImageClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain"
          />
          {children}
        </div>
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

// Types for the CDN-loaded pdfjs-dist
interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: string) => { promise: Promise<PdfDocument> };
}

interface PdfDocument {
  numPages: number;
  getPage: (num: number) => Promise<PdfPage>;
}

interface PdfPage {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
}

interface WindowWithPdfjs extends Window {
  __pdfjsLib?: PdfjsLib;
}
