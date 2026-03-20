import { apiPost, apiBlob } from "./client";

/**
 *
 */
export function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost<{ url: string; fileName: string }>("/api/upload", formData);
}

/**
 *
 */
export function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost<{ url: string }>("/api/avatar", formData);
}

/**
 *
 */
export function downloadFile(fileUrl: string) {
  return apiBlob(`/api/proxy-file?url=${encodeURIComponent(fileUrl)}`);
}
