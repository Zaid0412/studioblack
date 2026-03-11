import type {
  User,
  Project,
  Notification,
  Activity,
  TeamMember,
  Comment,
} from "@/types";

// ─── Users ───
export const currentUser: User = {
  id: "u1",
  name: "Alex Morgan",
  email: "alex@studioblack.com",
  role: "pm",
  initials: "AM",
};

export const users: User[] = [
  currentUser,
  {
    id: "u2",
    name: "Sarah Chen",
    email: "sarah@studioblack.com",
    role: "architect",
    initials: "SC",
  },
  {
    id: "u3",
    name: "James Wilson",
    email: "james@studioblack.com",
    role: "architect",
    initials: "JW",
  },
  {
    id: "u4",
    name: "Emily Davis",
    email: "emily@client.com",
    role: "client",
    initials: "ED",
  },
  {
    id: "u5",
    name: "Michael Park",
    email: "michael@client.com",
    role: "client",
    initials: "MP",
  },
];

// ─── Projects ───
export const projects: Project[] = [
  {
    id: "p1",
    name: "Riverside Tower",
    client: "Henderson Properties",
    category: "residential",
    status: "active",
    deadline: "2026-04-15",
    description: "35-story mixed-use residential tower with commercial podium",
    team: [users[0], users[1]],
    designSections: [
      {
        id: "d1",
        name: "Floor Plans",
        status: "approved-arch",
        version: 3,
        uploadedBy: "Alex Morgan",
        uploadedAt: "2026-03-01",
      },
      {
        id: "d2",
        name: "Elevations",
        status: "in-review",
        version: 2,
        uploadedBy: "Sarah Chen",
        uploadedAt: "2026-03-05",
      },
      {
        id: "d3",
        name: "Site Plan",
        status: "submitted",
        version: 1,
        uploadedBy: "Alex Morgan",
        uploadedAt: "2026-03-07",
      },
    ],
    createdAt: "2026-01-10",
    updatedAt: "2026-03-07",
  },
  {
    id: "p2",
    name: "Marina Bay Offices",
    client: "Coastal Developments",
    category: "commercial",
    status: "active",
    deadline: "2026-05-20",
    description: "Modern office complex with sustainable design features",
    team: [users[0], users[2]],
    designSections: [
      {
        id: "d4",
        name: "Structural Plans",
        status: "changes-requested",
        version: 4,
        uploadedBy: "James Wilson",
        uploadedAt: "2026-02-28",
      },
      {
        id: "d5",
        name: "Interior Layout",
        status: "draft",
        version: 1,
        uploadedBy: "Alex Morgan",
        uploadedAt: "2026-03-02",
      },
    ],
    createdAt: "2026-01-20",
    updatedAt: "2026-03-05",
  },
  {
    id: "p3",
    name: "Greenfield Campus",
    client: "Metro University",
    category: "institutional",
    status: "active",
    deadline: "2026-06-30",
    description: "University campus expansion with new science building",
    team: [users[1], users[2]],
    designSections: [
      {
        id: "d6",
        name: "Master Plan",
        status: "approved-client",
        version: 2,
        uploadedBy: "Sarah Chen",
        uploadedAt: "2026-02-15",
      },
    ],
    createdAt: "2025-12-01",
    updatedAt: "2026-03-01",
  },
  {
    id: "p4",
    name: "Heritage Renovation",
    client: "City Council",
    category: "institutional",
    status: "draft",
    deadline: "2026-07-10",
    description: "Restoration of historic city hall with modern additions",
    team: [users[0]],
    designSections: [],
    createdAt: "2026-03-01",
    updatedAt: "2026-03-01",
  },
  {
    id: "p5",
    name: "Sunset Residences",
    client: "Golden Gate Homes",
    category: "residential",
    status: "completed",
    deadline: "2026-02-28",
    description: "Luxury residential development with 48 units",
    team: [users[0], users[1], users[2]],
    designSections: [
      {
        id: "d7",
        name: "All Drawings",
        status: "approved-client",
        version: 5,
        uploadedBy: "Alex Morgan",
        uploadedAt: "2026-02-20",
      },
    ],
    createdAt: "2025-09-15",
    updatedAt: "2026-02-28",
  },
  {
    id: "p6",
    name: "Tech Park Plaza",
    client: "InnoVentures",
    category: "workspace",
    status: "active",
    deadline: "2026-05-01",
    description: "Technology park with shared workspaces and amenities",
    team: [users[2]],
    designSections: [
      {
        id: "d8",
        name: "Landscape Design",
        status: "submitted",
        version: 1,
        uploadedBy: "James Wilson",
        uploadedAt: "2026-03-06",
      },
    ],
    createdAt: "2026-02-01",
    updatedAt: "2026-03-06",
  },
];

// ─── Team Members ───
export const teamMembers: TeamMember[] = [
  {
    ...users[0],
    projects: 4,
    status: "active",
    joinedAt: "2025-01-15",
  },
  {
    ...users[1],
    projects: 3,
    status: "active",
    joinedAt: "2025-03-20",
  },
  {
    ...users[2],
    projects: 3,
    status: "active",
    joinedAt: "2025-06-10",
  },
  {
    id: "u6",
    name: "Lisa Nguyen",
    email: "lisa@studioblack.com",
    role: "architect",
    initials: "LN",
    projects: 0,
    status: "invited",
    joinedAt: "2026-03-07",
  },
];

// ─── Notifications ───
export const notifications: Notification[] = [
  {
    id: "n1",
    title: "New review submitted",
    description:
      "Sarah Chen submitted a review for Riverside Tower — Elevations",
    type: "review",
    read: false,
    createdAt: "2026-03-08T10:30:00Z",
    projectId: "p1",
  },
  {
    id: "n2",
    title: "Design approved",
    description: "Floor Plans for Riverside Tower have been approved",
    type: "approval",
    read: false,
    createdAt: "2026-03-08T09:15:00Z",
    projectId: "p1",
  },
  {
    id: "n3",
    title: "New comment",
    description:
      "James Wilson commented on Marina Bay Offices — Structural Plans",
    type: "comment",
    read: false,
    createdAt: "2026-03-07T16:45:00Z",
    projectId: "p2",
  },
  {
    id: "n4",
    title: "Deadline approaching",
    description: "Riverside Tower deadline is in 38 days",
    type: "deadline",
    read: true,
    createdAt: "2026-03-07T08:00:00Z",
    projectId: "p1",
  },
  {
    id: "n5",
    title: "Design uploaded",
    description: "New version of Landscape Design uploaded for Tech Park Plaza",
    type: "upload",
    read: true,
    createdAt: "2026-03-06T14:20:00Z",
    projectId: "p6",
  },
  {
    id: "n6",
    title: "Team member invited",
    description: "Lisa Nguyen has been invited to join the team",
    type: "team",
    read: true,
    createdAt: "2026-03-06T11:00:00Z",
  },
];

// ─── Activity ───
export const activities: Activity[] = [
  {
    id: "a1",
    action: "Submitted review",
    user: "Sarah Chen",
    project: "Riverside Tower",
    details: "Reviewed Elevations v2",
    timestamp: "2026-03-08T10:30:00Z",
    type: "review",
  },
  {
    id: "a2",
    action: "Approved design",
    user: "Alex Morgan",
    project: "Riverside Tower",
    details: "Approved Floor Plans v3",
    timestamp: "2026-03-08T09:15:00Z",
    type: "approval",
  },
  {
    id: "a3",
    action: "Uploaded design",
    user: "James Wilson",
    project: "Tech Park Plaza",
    details: "Uploaded Landscape Design v1",
    timestamp: "2026-03-06T14:20:00Z",
    type: "upload",
  },
  {
    id: "a4",
    action: "Requested changes",
    user: "Emily Davis",
    project: "Marina Bay Offices",
    details: "Changes requested for Structural Plans",
    timestamp: "2026-03-05T11:30:00Z",
    type: "review",
  },
  {
    id: "a5",
    action: "Created project",
    user: "Alex Morgan",
    project: "Heritage Renovation",
    details: "New project created",
    timestamp: "2026-03-01T09:00:00Z",
    type: "create",
  },
  {
    id: "a6",
    action: "Added comment",
    user: "Sarah Chen",
    project: "Greenfield Campus",
    details: "Commented on Master Plan",
    timestamp: "2026-02-28T15:45:00Z",
    type: "comment",
  },
];

// ─── Comments ───
export const comments: Comment[] = [
  {
    id: "c1",
    author: users[1],
    content:
      "Please adjust the elevation on the north side to match the updated floor plan dimensions.",
    createdAt: "2026-03-08T10:30:00Z",
    designId: "d2",
  },
  {
    id: "c2",
    author: users[0],
    content:
      "The setback on level 3 needs to be increased by 2m per the latest council feedback.",
    createdAt: "2026-03-07T14:00:00Z",
    designId: "d2",
  },
  {
    id: "c3",
    author: users[3],
    content:
      "Overall design direction looks great. Can we see a rendered perspective from the street level?",
    createdAt: "2026-03-06T09:30:00Z",
    designId: "d2",
  },
];

// ─── Helpers ───

/**
 * Look up a project by its unique ID.
 * @param id - The project ID to search for.
 * @returns The matching Project, or `undefined` if not found.
 */
export function getProjectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

/**
 * Look up a user by their unique ID.
 * @param id - The user ID to search for.
 * @returns The matching User, or `undefined` if not found.
 */
export function getUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

/**
 * Count unread notifications for the badge in the sidebar.
 * @returns Number of notifications where `read` is `false`.
 */
export function getUnreadNotificationCount(): number {
  return notifications.filter((n) => !n.read).length;
}
