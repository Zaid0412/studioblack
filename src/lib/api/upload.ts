import { apiPost, apiBlob } from "./client";
import { API } from "./routes";

/** Upload a file and return its URL and file name. */
export function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPost<{ url: string; fileName: string }>(API.upload(), formData);
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
