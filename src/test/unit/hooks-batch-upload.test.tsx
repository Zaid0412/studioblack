// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUploadFile = vi.fn();
const mockAttachmentsCreate = vi.fn();

vi.mock("@/lib/api", () => ({
  upload: { uploadFile: (...args: unknown[]) => mockUploadFile(...args) },
  attachments: {
    create: (...args: unknown[]) => mockAttachmentsCreate(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAttachmentsCreate.mockResolvedValue({ id: "att-1" });
});

import { useBatchUpload } from "@/hooks/useBatchUpload";

function makeFiles(n: number): File[] {
  return Array.from(
    { length: n },
    (_, i) => new File([`content-${i}`], `file-${i}.pdf`)
  );
}

describe("useBatchUpload", () => {
  it("uploads all files and marks completed", async () => {
    mockUploadFile.mockImplementation(async (file: File) => ({
      url: `https://cdn/${file.name}`,
      fileName: file.name,
    }));

    const { result } = renderHook(() => useBatchUpload());
    const files = makeFiles(3);

    let outcome: {
      completed: boolean;
      uploaded: number;
      total: number;
    } | null = null;
    await act(async () => {
      outcome = await result.current.uploadBatch({
        files,
        projectId: "proj-1",
        phaseId: null,
      });
    });

    expect(outcome).toEqual({ completed: true, uploaded: 3, total: 3 });
    expect(mockUploadFile).toHaveBeenCalledTimes(3);
    expect(mockAttachmentsCreate).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBeNull();
    expect(result.current.uploading).toBe(false);
  });

  it("skips already-uploaded indices when retried after partial failure", async () => {
    // First pass: index 2 fails, 0 and 1 succeed.
    mockUploadFile.mockImplementation(async (file: File) => {
      if (file.name === "file-2.pdf") throw new Error("net");
      return { url: `https://cdn/${file.name}`, fileName: file.name };
    });

    const { result } = renderHook(() => useBatchUpload());
    const files = makeFiles(3);

    let first: { completed: boolean; uploaded: number; total: number } | null =
      null;
    await act(async () => {
      first = await result.current.uploadBatch({
        files,
        projectId: "proj-1",
        phaseId: null,
      });
    });

    expect(first).toEqual({ completed: false, uploaded: 2, total: 3 });
    expect(mockUploadFile).toHaveBeenCalledTimes(3);
    expect(mockAttachmentsCreate).toHaveBeenCalledTimes(2);
    expect(result.current.error).toMatch(/2\/3 files uploaded/);

    // Second pass: everything succeeds; already-uploaded files must be skipped.
    mockUploadFile.mockClear();
    mockAttachmentsCreate.mockClear();
    mockUploadFile.mockImplementation(async (file: File) => ({
      url: `https://cdn/${file.name}`,
      fileName: file.name,
    }));

    let second: { completed: boolean; uploaded: number; total: number } | null =
      null;
    await act(async () => {
      second = await result.current.uploadBatch({
        files,
        projectId: "proj-1",
        phaseId: null,
      });
    });

    expect(second).toEqual({ completed: true, uploaded: 3, total: 3 });
    // Only the previously-failed file (index 2) should be retried.
    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockAttachmentsCreate).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it("reset() clears tracked uploads so the next batch starts fresh", async () => {
    mockUploadFile.mockImplementation(async (file: File) => ({
      url: `https://cdn/${file.name}`,
      fileName: file.name,
    }));

    const { result } = renderHook(() => useBatchUpload());
    const files = makeFiles(2);

    await act(async () => {
      await result.current.uploadBatch({
        files,
        projectId: "proj-1",
        phaseId: null,
      });
    });
    expect(mockUploadFile).toHaveBeenCalledTimes(2);

    act(() => result.current.reset());

    mockUploadFile.mockClear();
    mockAttachmentsCreate.mockClear();
    await act(async () => {
      await result.current.uploadBatch({
        files,
        projectId: "proj-1",
        phaseId: null,
      });
    });
    // After reset, both files should be re-uploaded.
    expect(mockUploadFile).toHaveBeenCalledTimes(2);
    expect(mockAttachmentsCreate).toHaveBeenCalledTimes(2);
  });

  it("prefers displayNames[i] over the server-returned fileName", async () => {
    mockUploadFile.mockResolvedValue({
      url: "https://cdn/raw.pdf",
      fileName: "raw.pdf",
    });

    const { result } = renderHook(() => useBatchUpload());
    await act(async () => {
      await result.current.uploadBatch({
        files: [new File([""], "raw.pdf")],
        projectId: "proj-1",
        phaseId: null,
        displayNames: ["My Design.pdf"],
      });
    });

    expect(mockAttachmentsCreate).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({ fileName: "My Design.pdf" })
    );
  });

  it("passes versionGroup through when provided", async () => {
    mockUploadFile.mockResolvedValue({
      url: "https://cdn/f.pdf",
      fileName: "f.pdf",
    });

    const { result } = renderHook(() => useBatchUpload());
    await act(async () => {
      await result.current.uploadBatch({
        files: [new File([""], "f.pdf")],
        projectId: "proj-1",
        phaseId: "phase-1",
        versionGroup: "vg-1",
      });
    });

    expect(mockAttachmentsCreate).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({ versionGroup: "vg-1", phaseId: "phase-1" })
    );
  });
});
