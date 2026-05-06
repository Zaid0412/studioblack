import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTaskById, getTaskActivity } from "@/lib/queries";
import { auth } from "@/lib/auth";
import { GET as ACTIVITY } from "@/app/api/tasks/[id]/activity/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
  TEST_USER_ID,
} from "../helpers";
import type { TaskActivityEntry } from "@/types";

const TASK_ID = "task-test-001";

const fakeTask = {
  id: TASK_ID,
  org_id: TEST_ORG_ID,
  project_id: null,
  phase_id: null,
  title: "Test task",
  description: "",
  status: "todo",
  priority: "medium",
  category: "general",
  created_by: TEST_USER_ID,
  assigned_to: TEST_USER_ID,
  due_date: null,
  completed_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const fakeActivity: TaskActivityEntry[] = [
  {
    kind: "comment",
    id: "c1",
    author_id: TEST_USER_ID,
    author_name: "Test User",
    body: "Hello",
    attachments: [],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: null,
  },
  {
    kind: "event",
    id: "e1",
    actor_id: TEST_USER_ID,
    actor_name: "Test User",
    action: "task.status_changed",
    metadata: { from: "todo", to: "in_progress" },
    created_at: "2024-01-01T00:01:00Z",
  },
];

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

function authAsPm() {
  setupAuth(
    {
      getSession: vi.mocked(auth.api.getSession),
      listOrganizations: vi.mocked(auth.api.listOrganizations),
      listMembers: vi.mocked(auth.api.listMembers),
    },
    pmSession
  );
}

function authAsClient() {
  setupAuth(
    {
      getSession: vi.mocked(auth.api.getSession),
      listOrganizations: vi.mocked(auth.api.listOrganizations),
      listMembers: vi.mocked(auth.api.listMembers),
    },
    clientSession
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authAsPm();
});

describe("GET /api/tasks/[id]/activity", () => {
  it("returns the merged comment + event feed", async () => {
    vi.mocked(getTaskById).mockResolvedValue(fakeTask);
    vi.mocked(getTaskActivity).mockResolvedValue(fakeActivity);

    const res = await ACTIVITY(
      buildRequest(`/api/tasks/${TASK_ID}/activity`),
      buildParams({ id: TASK_ID })
    );
    const { status, body } = await parseResponse<{
      events: TaskActivityEntry[];
    }>(res);
    expect(status).toBe(200);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].kind).toBe("comment");
    expect(body.events[1].kind).toBe("event");
    expect(getTaskActivity).toHaveBeenCalledWith(TASK_ID, TEST_ORG_ID);
  });

  it("returns 404 when task missing", async () => {
    vi.mocked(getTaskById).mockResolvedValue(null);
    const res = await ACTIVITY(
      buildRequest(`/api/tasks/${TASK_ID}/activity`),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(404);
    expect(getTaskActivity).not.toHaveBeenCalled();
  });

  it("rejects client role", async () => {
    authAsClient();
    const res = await ACTIVITY(
      buildRequest(`/api/tasks/${TASK_ID}/activity`),
      buildParams({ id: TASK_ID })
    );
    expect(res.status).toBe(403);
  });
});
