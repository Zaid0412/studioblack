import { upload } from "@/lib/api";

/**
 * Trigger a browser save dialog for an in-memory Blob.
 *
 * The anchor must be attached to the DOM for reliable cross-browser click
 * dispatch, and the object URL must survive until the browser has finished
 * reading it (Safari/Firefox read asynchronously for large blobs). Revoke
 * on the next tick via `setTimeout(…, 0)`.
 */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

/** Download a file by URL and trigger a browser save dialog. */
export async function downloadFile(fileUrl: string, fileName: string) {
  const blob = await upload.downloadFile(fileUrl);
  saveBlob(blob, fileName);
}

/**
 * Trigger a save-as for a signed Supabase URL by appending `?download=<name>`
 * so Supabase emits `Content-Disposition: attachment` for that single
 * request. No blob fetch — streams from Supabase straight to disk regardless
 * of file size.
 */
export function downloadFromSignedUrl(url: string, fileName: string) {
  const sep = url.includes("?") ? "&" : "?";
  const a = document.createElement("a");
  a.href = `${url}${sep}download=${encodeURIComponent(fileName)}`;
  a.download = fileName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
