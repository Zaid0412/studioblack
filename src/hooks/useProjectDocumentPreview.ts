import useSWR from "swr";
import { projectDocuments } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { isFilePreviewable } from "@/components/ui/FilePreview";
import type { DbProjectDocument } from "@/types";

interface PreviewHandle {
  previewable: boolean;
  previewUrl: string | undefined;
  refreshUrl: () => Promise<string>;
}

/**
 * Cached signed-URL fetch for a `DbProjectDocument`'s preview. Skips the
 * fetch entirely when the doc is null or the file type isn't previewable.
 * `refreshUrl` mints a fresh URL on demand for toolbar actions whose
 * lifetime can outrun the cached one.
 */
export function useProjectDocumentPreview(
  projectId: string,
  doc: DbProjectDocument | null
): PreviewHandle {
  const previewable = !!doc && isFilePreviewable(doc.mime_type, doc.file_name);
  const { data } = useSWR<{ url: string }>(
    previewable && doc ? API.projectDocumentDownload(projectId, doc.id) : null,
    { revalidateOnFocus: false, revalidateIfStale: false }
  );
  return {
    previewable,
    previewUrl: data?.url,
    refreshUrl: async () => {
      if (!doc) throw new Error("No document loaded.");
      const { url } = await projectDocuments.getDownloadUrl(projectId, doc.id);
      return url;
    },
  };
}
