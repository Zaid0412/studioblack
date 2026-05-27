// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/useToast", () => ({
  toast: vi.fn(),
}));

import { FilePreview, isFilePreviewable } from "@/components/ui/FilePreview";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/useToast";

/** Tooltip primitives require a provider in the tree. */
function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

const FAKE_URL = "https://example.test/file.pdf?token=abc";
const FAKE_IMG_URL = "https://example.test/photo.jpg?token=def";

// ─── isFilePreviewable predicate ────────────────────────────────────────────

describe("isFilePreviewable", () => {
  it("matches image mimes", () => {
    expect(isFilePreviewable("image/png", "x.png")).toBe(true);
    expect(isFilePreviewable("image/jpeg", "anything")).toBe(true);
  });
  it("matches application/pdf mime", () => {
    expect(isFilePreviewable("application/pdf", "x.pdf")).toBe(true);
  });
  it("falls back to filename extension when mime is missing", () => {
    expect(isFilePreviewable(undefined, "site-plan.pdf")).toBe(true);
    expect(isFilePreviewable(undefined, "photo.jpg")).toBe(true);
    expect(isFilePreviewable(undefined, "notes.docx")).toBe(false);
  });
  it("rejects unsupported types regardless of filename", () => {
    expect(isFilePreviewable("application/zip", "archive.zip")).toBe(false);
    expect(isFilePreviewable("text/csv", "data.csv")).toBe(false);
  });
});

// ─── FilePreview action handlers ─────────────────────────────────────────────

describe("FilePreview actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("renders the unsupported card for non-image, non-pdf files", () => {
    renderWithProviders(<FilePreview url={FAKE_URL} fileName="archive.zip" />);
    expect(
      screen.getByText(/Preview not supported for this file type\./i)
    ).toBeDefined();
  });

  it("hides the fullscreen action on unsupported file types", () => {
    renderWithProviders(<FilePreview url={FAKE_URL} fileName="archive.zip" />);
    // Hover the wrapper to reveal the desktop toolbar — Radix tooltip
    // triggers exist for the actions that ARE applicable.
    const wrapper = screen
      .getByText(/Preview not supported/i)
      .closest("div.group");
    if (wrapper) fireEvent.mouseEnter(wrapper);
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open in new tab" })
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Download" })).toBeDefined();
  });

  it("openInNewTab calls window.open with the URL", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithProviders(
      <FilePreview url={FAKE_IMG_URL} fileName="photo.jpg" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in new tab" }));
    // Promise microtask for runAction's await
    return Promise.resolve().then(() => {
      expect(openSpy).toHaveBeenCalledWith(
        FAKE_IMG_URL,
        "_blank",
        "noopener,noreferrer"
      );
      openSpy.mockRestore();
    });
  });

  it("download triggers an anchor click with the download disposition", () => {
    const clicks: HTMLAnchorElement[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this);
    };
    renderWithProviders(
      <FilePreview url={FAKE_IMG_URL} fileName="photo.jpg" />
    );
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    return Promise.resolve().then(() => {
      expect(clicks).toHaveLength(1);
      const a = clicks[0];
      expect(a.getAttribute("download")).toBe("photo.jpg");
      expect(a.href).toContain("download=photo.jpg");
      HTMLAnchorElement.prototype.click = realClick;
    });
  });

  it("copy URL for non-image files writes the URL to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderWithProviders(<FilePreview url={FAKE_URL} fileName="archive.zip" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    // Two microtasks: the action's await + clipboard.writeText's await
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(FAKE_URL);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Link copied." })
    );
  });

  it("uses refreshUrl callback when minting the URL for an action", async () => {
    const FRESH_URL = "https://example.test/file.pdf?token=fresh";
    const refreshUrl = vi.fn().mockResolvedValue(FRESH_URL);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithProviders(
      <FilePreview
        url={FAKE_IMG_URL}
        fileName="photo.jpg"
        refreshUrl={refreshUrl}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in new tab" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshUrl).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      FRESH_URL,
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });

  it("falls back to cached URL when refreshUrl rejects", async () => {
    const refreshUrl = vi.fn().mockRejectedValue(new Error("expired"));
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithProviders(
      <FilePreview
        url={FAKE_IMG_URL}
        fileName="photo.jpg"
        refreshUrl={refreshUrl}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in new tab" }));
    await Promise.resolve();
    await Promise.resolve();
    expect(openSpy).toHaveBeenCalledWith(
      FAKE_IMG_URL,
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });
});
