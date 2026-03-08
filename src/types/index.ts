export type UserRole = "architect" | "client" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  initials: string;
}

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  deadline: string;
  description: string;
  team: User[];
  designSections: DesignSection[];
  createdAt: string;
  updatedAt: string;
}

export type DesignStatus =
  | "draft"
  | "submitted"
  | "in-review"
  | "approved-arch"
  | "approved-client"
  | "changes-requested";

export interface DesignSection {
  id: string;
  name: string;
  status: DesignStatus;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  fileUrl?: string;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  designId?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  type: "review" | "comment" | "approval" | "upload" | "deadline" | "team";
  read: boolean;
  createdAt: string;
  projectId?: string;
}

export interface Activity {
  id: string;
  action: string;
  user: string;
  project: string;
  details: string;
  timestamp: string;
  type: "upload" | "review" | "approval" | "comment" | "create" | "edit";
}

export interface TeamMember extends User {
  projects: number;
  status: "active" | "invited" | "inactive";
  joinedAt: string;
}

export interface StatCard {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}
