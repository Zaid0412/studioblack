import { apiBlob, apiPost, ApiError } from "./client";
import { API } from "./routes";

/** Upload a file to Supabase Storage via a short-lived signed URL. */
export async function uploadFile(
  file: File
): Promise<{ url: string; fileName: string }> {
  const { signedUrl, publicUrl } = await apiPost<{
    signedUrl: string;
    publicUrl: string;
  }>(API.uploadSignedUrl(), {
    fileName: file.name,
    fileSize: file.size,
  });

  const res = await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `Upload failed (${res.status})`);
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
