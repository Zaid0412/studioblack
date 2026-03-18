/** Roles available to authenticated users. */
export type UserRole = "pm" | "architect" | "client";

/** A registered user in the platform. */
export interface User {
  /** Unique identifier. */
  id: string;
  /** Full display name. */
  name: string;
  /** Email address used for login and notifications. */
  email: string;
  /** Determines sidebar layout and accessible routes. */
  role: UserRole;
  /** Optional URL to a profile image. Falls back to {@link initials}. */
  avatar?: string;
  /** 1-2 character abbreviation rendered inside the Avatar component. */
  initials: string;
}

/** Lifecycle stages of an architectural project. */
export type ProjectStatus = "draft" | "active" | "completed" | "archived";

/** Architectural project categories. */
export type ProjectCategory =
  | "residential"
  | "commercial"
  | "healthcare"
  | "hospitality"
  | "institutional"
  | "retail"
  | "workspace";

/** A top-level architectural project containing one or more design sections. */
export interface Project {
  id: string;
  /** Human-readable project title. */
  name: string;
  /** Name of the client organisation. */
  client: string;
  /** Architectural category of the project. */
  category: ProjectCategory;
  status: ProjectStatus;
  /** ISO-8601 date string representing the delivery deadline. */
  deadline: string;
  /** Short summary shown on project cards and detail pages. */
  description: string;
  /** Team members assigned to this project. */
  team: User[];
  /** Individual design deliverables (e.g. floor plans, elevations). */
  designSections: DesignSection[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-modified timestamp. */
  updatedAt: string;
}

/**
 * Approval pipeline stages for a single design deliverable.
 *
 * Flow: draft → submitted → in-review → approved-arch → approved-client
 * (changes-requested can occur from in-review or later)
 */
export type DesignStatus =
  | "draft"
  | "submitted"
  | "in-review"
  | "approved-arch"
  | "approved-client"
  | "changes-requested";

/** A single design deliverable within a Project. */
export interface DesignSection {
  id: string;
  /** Descriptive label (e.g. "Floor Plans", "Elevations"). */
  name: string;
  status: DesignStatus;
  /** Monotonically increasing version number, bumped on each upload. */
  version: number;
  /** Display name of the user who last uploaded this section. */
  uploadedBy: string;
  /** ISO-8601 timestamp of the most recent upload. */
  uploadedAt: string;
  /** URL to the uploaded design file (PDF / image). */
  fileUrl?: string;
}

/** A review comment attached to a design section. */
export interface Comment {
  id: string;
  /** The user who authored the comment. */
  author: User;
  /** Markdown-compatible comment body. */
  content: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** The design section this comment is attached to. */
  designId?: string;
}

/** An in-app notification shown in the notification centre. */
export interface Notification {
  id: string;
  /** Short headline shown in the notification list. */
  title: string;
  /** Longer explanatory text. */
  description: string;
  /** Category used to pick the icon and colour in the UI. */
  type:
    | "review"
    | "comment"
    | "approval"
    | "upload"
    | "deadline"
    | "team"
    | "invitation"
    | "task_assigned"
    | "review_requested"
    | "review_submitted";
  /** Whether the user has already seen this notification. */
  read: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Optional link to the related project. */
  projectId?: string;
}

/** A single entry in the activity feed (dashboard & audit history). */
export interface Activity {
  id: string;
  /** Human-readable description of the action taken. */
  action: string;
  /** Display name of the user who performed the action. */
  user: string;
  /** Name of the related project. */
  project: string;
  /** Additional context (e.g. "Reviewed Elevations v2"). */
  details: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Category used to pick the icon and colour in the UI. */
  type: "upload" | "review" | "approval" | "comment" | "create" | "edit";
}

/** Extended User with team-management metadata. */
export interface TeamMember extends User {
  /** Number of projects this member is assigned to. */
  projects: number;
  /** Current membership status. */
  status: "active" | "invited" | "inactive";
  /** ISO-8601 date when the member joined the team. */
  joinedAt: string;
}

/** Data shape for the reusable StatCard component. */
export interface StatCard {
  /** Descriptive label displayed above the value. */
  label: string;
  /** Primary metric value. */
  value: string | number;
  /** Secondary description (e.g. "+2 this month"). */
  change?: string;
  /** Directional indicator that determines the change colour. */
  trend?: "up" | "down" | "neutral";
}

// ---------------------------------------------------------------------------
// DB-facing types (used by dashboard pages)
// ---------------------------------------------------------------------------

/** Attachment record from the database. */
export interface DbAttachment {
  id: string;
  file_url: string;
  file_name: string;
  description: string;
  phase_id: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
  version?: number;
  version_group?: string;
  review_status?: string;
  reviewed_by_name?: string | null;
  versions?: DbAttachment[];
}

/** Comment record from the database. */
export interface DbComment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_role: string;
  created_at: string;
}

/** Phase record from the database. */
export interface DbPhase {
  id: string;
  name: string;
  phase_order: number;
  status?: string;
}

/** Workflow step record. */
export interface DbStep {
  id: string;
  name: string;
  step_order: number;
  status: string;
}

/** Project team member record. */
export interface DbMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

/** Full project detail from the API. */
export interface DbProjectDetail {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  status: string;
  description: string;
  deadline: string | null;
  created_at: string;
  phases: DbPhase[];
  members: DbMember[];
  steps?: DbStep[];
}

/** Project row from the projects list API. */
export interface DbProjectRow {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  category: string;
  status: ProjectStatus;
  deadline: string | null;
  created_at: string;
  updated_at?: string;
  architect_ids: string[] | null;
}

/** Organisation member from better-auth. */
export interface OrgMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

/** Organisation invitation from better-auth. */
export interface OrgInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
}

/** A single review round on an attachment (like a GitHub PR review). */
export interface DbAttachmentReview {
  id: string;
  attachment_id: string;
  reviewer_id: string;
  reviewer_name: string;
  status: "approved" | "rejected";
  comment: string;
  annotated_file_url: string | null;
  annotation_count: number;
  created_at: string;
}

/** DB notification row from the notifications API. */
export interface DbNotificationRow {
  id: string;
  type: string;
  title: string;
  description: string;
  read: boolean;
  created_at: string;
  project_id: string | null;
  project_name: string | null;
}
