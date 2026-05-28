import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "./client";
import { API } from "./routes";
import { toast } from "@/components/ui/useToast";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";

// ── Sections ───────────────────────────────────────────────────────────────

/** List sections for a project (auto-seeds defaults on first call). */
export function listSections(projectId: string) {
  return apiGet<DbProjectDocumentSection[]>(
    API.projectDocumentSections(projectId)
  );
}

/** Create a new section in a project. PM / architect only. */
export function createSection(
  projectId: string,
  data: { name: string; icon?: string; parentId?: string | null }
) {
  return apiPost<DbProjectDocumentSection>(
    API.projectDocumentSections(projectId),
    data
  );
}

/** Rename, re-icon, or reorder a section. */
export function updateSection(
  projectId: string,
  sectionId: string,
  data: {
    name?: string;
    icon?: string;
    position?: number;
    parentId?: string | null;
  }
) {
  return apiPatch<DbProjectDocumentSection>(
    API.projectDocumentSection(projectId, sectionId),
    data
  );
}

/** Delete a section and every document inside it. */
export function deleteSection(projectId: string, sectionId: string) {
  return apiDelete(API.projectDocumentSection(projectId, sectionId));
}

// ── Documents ──────────────────────────────────────────────────────────────

/** List documents in a section. */
export function listDocuments(projectId: string, sectionId: string) {
  return apiGet<DbProjectDocument[]>(
    API.projectDocuments(projectId, sectionId)
  );
}

/** List every document in a project (All view), with section name joined. */
export function listAllDocuments(projectId: string) {
  return apiGet<DbProjectDocument[]>(API.projectDocumentsAll(projectId));
}

/** Step 1 of upload — mint a signed PUT URL into the documents bucket. */
export function getUploadUrl(
  projectId: string,
  sectionId: string,
  data: { fileName: string; fileSize: number },
  opts?: { signal?: AbortSignal }
) {
  return apiPost<{ signedUrl: string; storagePath: string }>(
    API.projectDocumentUploadUrl(projectId, sectionId),
    data,
    opts
  );
}

/** Step 2 of upload — register the document row after the bytes are in storage. */
export function createDocument(
  projectId: string,
  sectionId: string,
  data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    description?: string | null;
  },
  opts?: { signal?: AbortSignal }
) {
  return apiPost<DbProjectDocument>(
    API.projectDocuments(projectId, sectionId),
    data,
    opts
  );
}

/**
 * Rename / edit description / move to a different section. Empty-string
 * description clears the field server-side.
 */
export function updateDocument(
  projectId: string,
  documentId: string,
  data: {
    fileName?: string;
    description?: string | null;
    sectionId?: string;
  }
) {
  return apiPatch<DbProjectDocument>(
    API.projectDocument(projectId, documentId),
    data
  );
}

/** Mint a short-lived signed download URL for a document. */
export function getDownloadUrl(projectId: string, documentId: string) {
  return apiGet<{ url: string }>(
    API.projectDocumentDownload(projectId, documentId)
  );
}

/**
 * Fetch a fresh signed URL and pass it to `onUrl`. Errors surface as a toast
 * with `fallbackMessage` (unless the server returned a richer `ApiError`).
 * Shared by every "Download / Open / Copy link" handler that operates on a
 * document or one of its versions.
 */
export async function withSignedUrl(
  projectId: string,
  documentId: string,
  fallbackMessage: string,
  onUrl: (url: string) => void | Promise<void>
): Promise<void> {
  try {
    const { url } = await getDownloadUrl(projectId, documentId);
    await onUrl(url);
  } catch (err) {
    toast({
      title: err instanceof ApiError ? err.message : fallbackMessage,
      variant: "error",
    });
  }
}

/** Delete a document (row + storage object). */
export function deleteDocument(projectId: string, documentId: string) {
  return apiDelete(API.projectDocument(projectId, documentId));
}

// ── Version history ────────────────────────────────────────────────────────

/** Fetch every row in the document's version group, oldest first. */
export function getVersionHistory(projectId: string, documentId: string) {
  return apiGet<DbProjectDocument[]>(
    API.projectDocumentVersions(projectId, documentId)
  );
}

/** Mint a signed PUT URL for a new version's bytes. */
export function getNewVersionUploadUrl(
  projectId: string,
  documentId: string,
  data: { fileName: string; fileSize: number },
  opts?: { signal?: AbortSignal }
) {
  return apiPost<{ signedUrl: string; storagePath: string }>(
    API.projectDocumentVersionUploadUrl(projectId, documentId),
    data,
    opts
  );
}

/** Register a new version row after the bytes are in storage. */
export function createNewVersion(
  projectId: string,
  documentId: string,
  data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    description?: string | null;
  },
  opts?: { signal?: AbortSignal }
) {
  return apiPost<DbProjectDocument>(
    API.projectDocumentVersions(projectId, documentId),
    data,
    opts
  );
}

/** Revert to an older version (appends a new row at MAX+1 with the target's bytes). */
export function revertToVersion(
  projectId: string,
  documentId: string,
  targetVersion: number
) {
  return apiPost<DbProjectDocument>(
    API.projectDocumentRevert(projectId, documentId),
    { targetVersion }
  );
}

/** Delete a single version row. Refused server-side when it's the last one. */
export function deleteVersion(
  projectId: string,
  documentId: string,
  versionId: string
) {
  return apiDelete(
    API.projectDocumentVersion(projectId, documentId, versionId)
  );
}
