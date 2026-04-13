import { upload } from "@/lib/api";

/** Download a file by URL and trigger a browser save dialog. */
export async function downloadFile(fileUrl: string, fileName: string) {
  const blob = await upload.downloadFile(fileUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
