// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUploadFile = vi.fn();
const mockUploadAvatar = vi.fn();
const mockDownloadFile = vi.fn();

vi.mock("@/lib/api", () => ({
  upload: {
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
    downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
  },
}));

beforeEach(() => vi.clearAllMocks());

// ── useFileUpload ────────────────────────────────────────────────────────────

import { useFileUpload, useAvatarUpload } from "@/hooks/useFileUpload";

describe("useFileUpload", () => {
  it("starts with uploading=false, error=null", () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("calls uploadFile then attach callback on success", async () => {
    mockUploadFile.mockResolvedValue({
      url: "https://cdn/file.pdf",
      fileName: "file.pdf",
    });
    const attach = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useFileUpload());

    await act(() =>
      result.current.uploadAndAttach(new File([""], "file.pdf"), attach)
    );

    expect(mockUploadFile).toHaveBeenCalled();
    expect(attach).toHaveBeenCalledWith({
      url: "https://cdn/file.pdf",
      fileName: "file.pdf",
    });
    expect(result.current.uploading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error and re-throws on upload failure", async () => {
    mockUploadFile.mockRejectedValue(new Error("Network error"));
    const attach = vi.fn();

    const { result } = renderHook(() => useFileUpload());

    let thrown: Error | undefined;
    await act(async () => {
      try {
        await result.current.uploadAndAttach(new File([""], "f.pdf"), attach);
      } catch (e) {
        thrown = e as Error;
      }
    });

    expect(thrown?.message).toBe("Network error");
    expect(attach).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Network error");
    expect(result.current.uploading).toBe(false);
  });

  it("sets error and re-throws on attach callback failure", async () => {
    mockUploadFile.mockResolvedValue({ url: "u", fileName: "f" });
    const attach = vi.fn().mockRejectedValue(new Error("DB error"));

    const { result } = renderHook(() => useFileUpload());

    let thrown: Error | undefined;
    await act(async () => {
      try {
        await result.current.uploadAndAttach(new File([""], "f.pdf"), attach);
      } catch (e) {
        thrown = e as Error;
      }
    });

    expect(thrown?.message).toBe("DB error");
    expect(result.current.error).toBe("DB error");
    expect(result.current.uploading).toBe(false);
  });

  it("setError clears error manually", async () => {
    mockUploadFile.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useFileUpload());

    await act(() =>
      result.current
        .uploadAndAttach(new File([""], "f.pdf"), vi.fn())
        .catch(() => {})
    );
    expect(result.current.error).toBe("fail");

    act(() => result.current.setError(null));
    expect(result.current.error).toBeNull();
  });
});

// ── useAvatarUpload ──────────────────────────────────────────────────────────

describe("useAvatarUpload", () => {
  const mockToast = vi.fn();
  const mockSaveImage = vi.fn().mockResolvedValue(undefined);
  const mockOnSuccess = vi.fn();
  const t = (key: string) => key;

  function makeEvent(file?: File) {
    return {
      target: { files: file ? [file] : [], value: "C:\\fakepath\\file" },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
  }

  function setup() {
    return renderHook(() =>
      useAvatarUpload({
        t,
        toast: mockToast,
        saveImage: mockSaveImage,
        onSuccess: mockOnSuccess,
      })
    );
  }

  it("rejects invalid file type with toast", async () => {
    const { result } = setup();
    const file = new File([""], "doc.pdf", { type: "application/pdf" });

    await act(() => result.current.handleAvatarChange(makeEvent(file)));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it("rejects file over 1MB with toast", async () => {
    const { result } = setup();
    const bigFile = new File(["x".repeat(1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });

    await act(() => result.current.handleAvatarChange(makeEvent(bigFile)));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it("uploads avatar and calls onSuccess on success", async () => {
    mockUploadAvatar.mockResolvedValue({ url: "https://cdn/avatar.png" });

    const { result } = setup();
    const file = new File(["img"], "avatar.png", { type: "image/png" });

    await act(() => result.current.handleAvatarChange(makeEvent(file)));

    expect(mockUploadAvatar).toHaveBeenCalledWith(file);
    expect(mockSaveImage).toHaveBeenCalledWith("https://cdn/avatar.png");
    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  it("shows error toast on upload failure", async () => {
    mockUploadAvatar.mockRejectedValue(new Error("upload failed"));

    const { result } = setup();
    const file = new File(["img"], "avatar.png", { type: "image/png" });

    await act(() => result.current.handleAvatarChange(makeEvent(file)));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(result.current.isUploading).toBe(false);
  });

  it("does nothing when no file selected", async () => {
    const { result } = setup();

    await act(() => result.current.handleAvatarChange(makeEvent()));

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});

// ── useToast ─────────────────────────────────────────────────────────────────

// useToast uses module-level singleton state — import the real module
import { useToast, toast } from "@/components/ui/useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toast() adds a toast to the list", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hello" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Hello");
    expect(result.current.toasts[0].open).toBe(true);

    // cleanup
    act(() => result.current.dismiss());
    act(() => vi.advanceTimersByTime(6000));
  });

  it("dismiss() sets toast open to false", () => {
    const { result } = renderHook(() => useToast());

    let id: string;
    act(() => {
      id = toast({ title: "Bye" }).id;
    });

    act(() => result.current.dismiss(id!));

    expect(result.current.toasts[0].open).toBe(false);

    // cleanup
    act(() => vi.advanceTimersByTime(6000));
  });

  it("respects TOAST_LIMIT of 3", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "A" });
      toast({ title: "B" });
      toast({ title: "C" });
      toast({ title: "D" });
    });

    expect(result.current.toasts).toHaveLength(3);
    // Most recent first
    expect(result.current.toasts[0].title).toBe("D");

    // cleanup
    act(() => result.current.dismiss());
    act(() => vi.advanceTimersByTime(6000));
  });

  it("update() modifies an existing toast", () => {
    const { result } = renderHook(() => useToast());

    let ref: ReturnType<typeof toast>;
    act(() => {
      ref = toast({ title: "Old" });
    });

    act(() => {
      ref!.update({ id: ref!.id, title: "New" });
    });

    expect(result.current.toasts[0].title).toBe("New");

    // cleanup
    act(() => result.current.dismiss());
    act(() => vi.advanceTimersByTime(6000));
  });

  it("REMOVE_TOAST removes toast after delay", () => {
    const { result } = renderHook(() => useToast());

    let id: string;
    act(() => {
      id = toast({ title: "Temp" }).id;
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => result.current.dismiss(id!));
    // Still in list (just closed)
    expect(result.current.toasts).toHaveLength(1);

    // Advance past TOAST_REMOVE_DELAY (5000ms)
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("dismiss without id dismisses all toasts", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: "A" });
      toast({ title: "B" });
    });
    expect(result.current.toasts).toHaveLength(2);

    act(() => result.current.dismiss());
    expect(result.current.toasts.every((t) => t.open === false)).toBe(true);

    // cleanup
    act(() => vi.advanceTimersByTime(6000));
  });
});

// ── downloadFile ─────────────────────────────────────────────────────────────

import { downloadFile } from "@/lib/download";

describe("downloadFile", () => {
  it("fetches blob, creates object URL, triggers download, revokes URL", async () => {
    const blob = new Blob(["data"]);
    mockDownloadFile.mockResolvedValue(blob);

    const mockClick = vi.fn();
    const mockAnchor = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockAnchor as unknown as HTMLElement
    );
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    const mockRevokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    await downloadFile("https://cdn/file.pdf", "file.pdf");

    expect(mockDownloadFile).toHaveBeenCalledWith("https://cdn/file.pdf");
    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
    expect(mockAnchor.href).toBe("blob:mock-url");
    expect(mockAnchor.download).toBe("file.pdf");
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    vi.unstubAllGlobals();
  });
});
