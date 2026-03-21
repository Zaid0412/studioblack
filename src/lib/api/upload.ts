import { apiPost, apiBlob } from "./client";
import { API } from "./routes";

/**
 *
 */
export function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost<{ url: string; fileName: string }>(API.upload, formData);
}

/**
 *
 */
export function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost<{ url: string }>(API.avatar, formData);
}

/**
 *
 */
export function downloadFile(fileUrl: string) {
  return apiBlob(API.proxyFile(fileUrl));
}
