import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
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
  data: { name: string; icon?: string }
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
  data: { name?: string; icon?: string; position?: number }
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
  data: { fileName: string; fileSize: number }
) {
  return apiPost<{ signedUrl: string; storagePath: string }>(
    API.projectDocumentUploadUrl(projectId, sectionId),
    data
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
  }
) {
  return apiPost<DbProjectDocument>(
    API.projectDocuments(projectId, sectionId),
    data
  );
}

/** Mint a short-lived signed download URL for a document. */
export function getDownloadUrl(projectId: string, documentId: string) {
  return apiGet<{ url: string }>(
    API.projectDocumentDownload(projectId, documentId)
  );
}

/** Delete a document (row + storage object). */
export function deleteDocument(projectId: string, documentId: string) {
  return apiDelete(API.projectDocument(projectId, documentId));
}
