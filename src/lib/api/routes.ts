/** Central route map — single source of truth for all API URLs. */
export const API = {
  // Projects
  projects: "/api/projects",
  project: (id: string) => `/api/projects/${id}`,

  // Attachments
  attachments: (projectId: string) => `/api/projects/${projectId}/attachments`,
  attachment: (projectId: string, fileId: string) =>
    `/api/projects/${projectId}/attachments/${fileId}`,
  attachmentReview: (projectId: string, fileId: string) =>
    `/api/projects/${projectId}/attachments/${fileId}/review`,
  attachmentUnfreeze: (projectId: string, fileId: string) =>
    `/api/projects/${projectId}/attachments/${fileId}/unfreeze`,
  versionHistory: (projectId: string, versionGroup: string) =>
    `/api/projects/${projectId}/versions/${versionGroup}`,

  // Comments
  comments: (projectId: string) => `/api/projects/${projectId}/comments`,

  // Approvals
  approvals: (projectId: string) => `/api/projects/${projectId}/approvals`,

  // Tasks
  tasks: "/api/tasks",
  task: (id: string) => `/api/tasks/${id}`,
  taskStar: (id: string) => `/api/tasks/${id}/star`,
  taskChecklist: (taskId: string) => `/api/tasks/${taskId}/checklist`,
  taskChecklistItem: (taskId: string, itemId: string) =>
    `/api/tasks/${taskId}/checklist/${itemId}`,
  taskChecklistReorder: (taskId: string) =>
    `/api/tasks/${taskId}/checklist/reorder`,
  taskAttachments: (taskId: string) => `/api/tasks/${taskId}/attachments`,
  taskAttachment: (taskId: string, attachmentId: string) =>
    `/api/tasks/${taskId}/attachments/${attachmentId}`,
  taskReview: (projectId: string, taskId: string) =>
    `/api/projects/${projectId}/tasks/${taskId}/review`,
  tasksPendingReview: (projectId: string) =>
    `/api/projects/${projectId}/tasks/pending-review`,

  // Notifications
  notifications: "/api/notifications",

  // Upload & files
  upload: "/api/upload",
  avatar: "/api/avatar",
  proxyFile: (fileUrl: string) =>
    `/api/proxy-file?url=${encodeURIComponent(fileUrl)}`,

  // Dashboard
  dashboard: "/api/dashboard",

  // Client portal
  clientProjects: "/api/client/projects",
} as const;
