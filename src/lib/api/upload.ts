import { apiBlob, apiPost, ApiError } from "./client";
import { API } from "./routes";

interface SignedUploadUrlResponse {
  signedUrl: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
}

/**
 * Upload a file directly to Supabase Storage via a short-lived signed URL.
 * Two-step flow: the server issues a tiny JSON response with the signed URL,
 * then the browser PUTs the file straight to Supabase — bypassing Vercel's
 * 4.5 MB serverless function body cap.
 */
export async function uploadFile(
  file: File
): Promise<{ url: string; fileName: string }> {
  const { signedUrl, publicUrl } = await apiPost<SignedUploadUrlResponse>(
    API.uploadSignedUrl(),
    { fileName: file.name, fileSize: file.size }
  );

  const res = await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new ApiError(res.status, msg || `Upload failed (${res.status})`);
  }

  return { url: publicUrl, fileName: file.name };
}

/** Upload an avatar image and return its URL. */
export function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost<{ url: string }>(API.avatar(), formData);
}

/** Download a file by URL as a Blob. */
export function downloadFile(fileUrl: string) {
  return apiBlob(API.proxyFile(fileUrl));
}
