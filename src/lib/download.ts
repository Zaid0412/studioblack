import { upload } from "@/lib/api";

/** Trigger a browser save dialog for an in-memory Blob. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download a file by URL and trigger a browser save dialog. */
export async function downloadFile(fileUrl: string, fileName: string) {
  const blob = await upload.downloadFile(fileUrl);
  saveBlob(blob, fileName);
}
