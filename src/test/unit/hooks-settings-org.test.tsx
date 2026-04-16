// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mock functions ──────────────────────────────────────────────────────────

const mockToast = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockUpdateUser = vi.fn();
const mockChangePassword = vi.fn();
const mockDeleteUser = vi.fn();
const mockSignOut = vi.fn();
const mockApiPost = vi.fn();
const mockAvatarUpload = vi.fn();

const mockOrgCreate = vi.fn();
const mockOrgInviteMember = vi.fn();
const mockOrgUpdateMemberRole = vi.fn();
const mockOrgRemoveMember = vi.fn();
const mockOrgCancelInvitation = vi.fn();
const mockOrgSetActive = vi.fn();
const mockOrgGetFullOrganization = vi.fn();
const mockOrgList = vi.fn();
const mockOrgAcceptInvitation = vi.fn();
const mockOrgRejectInvitation = vi.fn();
const mockOrgListUserInvitations = vi.fn();
const mockGetSession = vi.fn();

const mockNotifMarkRead = vi.fn();
const mockNotifMarkAllRead = vi.fn();
const mockNotifClearAll = vi.fn();
const mockNotifRemove = vi.fn();

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/components/ui/useToast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/lib/authClient", () => ({
  authClient: {
    useSession: () => ({
      data: {
        session: { activeOrganizationId: "org-1" },
        user: {
          id: "user-1",
          name: "Test User",
          email: "test@test.com",
          image: null,
        },
      },
    }),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    changePassword: (...args: unknown[]) => mockChangePassword(...args),
    deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
    organization: {
      create: (...args: unknown[]) => mockOrgCreate(...args),
      inviteMember: (...args: unknown[]) => mockOrgInviteMember(...args),
      updateMemberRole: (...args: unknown[]) =>
        mockOrgUpdateMemberRole(...args),
      removeMember: (...args: unknown[]) => mockOrgRemoveMember(...args),
      cancelInvitation: (...args: unknown[]) =>
        mockOrgCancelInvitation(...args),
      setActive: (...args: unknown[]) => mockOrgSetActive(...args),
      getFullOrganization: (...args: unknown[]) =>
        mockOrgGetFullOrganization(...args),
      list: (...args: unknown[]) => mockOrgList(...args),
      acceptInvitation: (...args: unknown[]) =>
        mockOrgAcceptInvitation(...args),
      rejectInvitation: (...args: unknown[]) =>
        mockOrgRejectInvitation(...args),
      listUserInvitations: (...args: unknown[]) =>
        mockOrgListUserInvitations(...args),
    },
  },
}));

vi.mock("@/hooks/useFileUpload", () => ({
  useAvatarUpload: () => ({
    isUploading: false,
    handleAvatarChange: mockAvatarUpload,
  }),
}));

vi.mock("@/lib/api/client", () => ({
  apiPost: (...args: unknown[]) => mockApiPost(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/api/routes", () => ({
  API: {
    changeEmail: () => "/api/settings/change-email",
    notifications: () => "/api/notifications",
  },
}));

vi.mock("@/lib/api", () => ({
  notifications: {
    markRead: (...args: unknown[]) => mockNotifMarkRead(...args),
    markAllRead: (...args: unknown[]) => mockNotifMarkAllRead(...args),
    clearAll: (...args: unknown[]) => mockNotifClearAll(...args),
    remove: (...args: unknown[]) => mockNotifRemove(...args),
  },
}));

vi.mock("@/contexts/UserRoleContext", () => ({
  useUserRoleContext: () => ({ role: "pm" as const, userId: "user-1" }),
}));

// Mock SWR to return empty data by default (avoid real fetching)
vi.mock("swr", () => ({
  default: () => ({ data: undefined, isLoading: false, mutate: vi.fn() }),
}));

vi.mock("@/lib/utils", () => ({
  deriveInitials: (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
}));

vi.mock("@/lib/constants", () => ({
  POLLING_INTERVAL_MS: 30000,
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default returns for auth calls
  mockUpdateUser.mockResolvedValue({});
  mockChangePassword.mockResolvedValue({ error: null });
  mockDeleteUser.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({});
  mockGetSession.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockOrgCreate.mockResolvedValue({ error: null });
  mockOrgInviteMember.mockResolvedValue({ error: null });
  mockOrgUpdateMemberRole.mockResolvedValue({ error: null });
  mockOrgRemoveMember.mockResolvedValue({ error: null });
  mockOrgCancelInvitation.mockResolvedValue({ error: null });
  mockOrgSetActive.mockResolvedValue({});
  mockOrgGetFullOrganization.mockResolvedValue({ data: null });
  mockOrgList.mockResolvedValue({ data: [] });
  mockOrgAcceptInvitation.mockResolvedValue({ error: null });
  mockOrgRejectInvitation.mockResolvedValue({ error: null });
  mockOrgListUserInvitations.mockResolvedValue({ data: [] });
  mockNotifMarkRead.mockResolvedValue(undefined);
  mockNotifMarkAllRead.mockResolvedValue(undefined);
  mockNotifClearAll.mockResolvedValue(undefined);
  mockNotifRemove.mockResolvedValue(undefined);
  mockApiPost.mockResolvedValue({});

  // sessionStorage stub
  vi.stubGlobal("sessionStorage", {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

// ── useSettings ─────────────────────────────────────────────────────────────

import { useSettings } from "@/app/(dashboard)/settings/_hooks/useSettings";

describe("useSettings", () => {
  it("renders without crashing and returns expected shape", () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current).toHaveProperty("handleSave");
    expect(result.current).toHaveProperty("handleChangePassword");
    expect(result.current).toHaveProperty("handleChangeEmail");
    expect(result.current).toHaveProperty("handleDeleteAccount");
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isChangingPassword).toBe(false);
  });

  it("handleSave calls updateUser and shows success toast", async () => {
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockUpdateUser).toHaveBeenCalledWith({ name: expect.any(String) });
    expect(mockRefresh).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  it("handleSave shows error toast on failure", async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error("fail"));

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
    expect(result.current.isSaving).toBe(false);
  });

  it("handleChangePassword rejects mismatched passwords", async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setNewPassword("password1");
      result.current.setConfirmNewPassword("different");
    });

    await act(async () => {
      await result.current.handleChangePassword();
    });

    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  it("handleChangePassword rejects password shorter than 8 chars", async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setNewPassword("short");
      result.current.setConfirmNewPassword("short");
    });

    await act(async () => {
      await result.current.handleChangePassword();
    });

    expect(mockChangePassword).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  it("handleChangePassword calls changePassword on valid input", async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setCurrentPassword("oldpassword");
      result.current.setNewPassword("newpassword123");
      result.current.setConfirmNewPassword("newpassword123");
    });

    await act(async () => {
      await result.current.handleChangePassword();
    });

    expect(mockChangePassword).toHaveBeenCalledWith({
      currentPassword: "oldpassword",
      newPassword: "newpassword123",
      revokeOtherSessions: false,
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
    // Fields should be cleared
    expect(result.current.currentPassword).toBe("");
    expect(result.current.newPassword).toBe("");
    expect(result.current.confirmNewPassword).toBe("");
  });

  it("handleChangePassword shows error when API returns error", async () => {
    mockChangePassword.mockResolvedValueOnce({
      error: { message: "Wrong password" },
    });

    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setCurrentPassword("wrong");
      result.current.setNewPassword("newpassword123");
      result.current.setConfirmNewPassword("newpassword123");
    });

    await act(async () => {
      await result.current.handleChangePassword();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  it("handleChangeEmail calls apiPost and stores to sessionStorage", async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setNewEmail("new@example.com");
    });

    await act(async () => {
      await result.current.handleChangeEmail();
    });

    expect(mockApiPost).toHaveBeenCalledWith("/api/settings/change-email", {
      newEmail: "new@example.com",
    });
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "emailChangeRequested",
      "true"
    );
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "emailChangePendingEmail",
      "new@example.com"
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
  });

  it("handleDeleteAccount calls deleteUser, signOut, and redirects", async () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setDeletePassword("mypassword");
    });

    await act(async () => {
      await result.current.handleDeleteAccount();
    });

    expect(mockDeleteUser).toHaveBeenCalledWith({
      password: "mypassword",
      callbackURL: "/login",
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });
});

// ── useOrganisation ─────────────────────────────────────────────────────────

import { useOrganisation } from "@/app/(dashboard)/organisation/_hooks/useOrganisation";

describe("useOrganisation", () => {
  it("renders without crashing and returns expected shape", () => {
    const { result } = renderHook(() => useOrganisation());

    expect(result.current).toHaveProperty("handleCreateOrg");
    expect(result.current).toHaveProperty("handleInvite");
    expect(result.current).toHaveProperty("handleLeaveOrg");
    expect(result.current).toHaveProperty("generateSlug");
    expect(result.current.activeOrg).toBeNull();
    expect(result.current.members).toEqual([]);
    expect(result.current.invitations).toEqual([]);
  });

  it("generateSlug converts name to URL-safe slug", () => {
    const { result } = renderHook(() => useOrganisation());

    expect(result.current.generateSlug("My Studio")).toBe("my-studio");
    expect(result.current.generateSlug("  Hello World  ")).toBe("hello-world");
    expect(result.current.generateSlug("Test@#$Studio")).toBe("test-studio");
    expect(result.current.generateSlug("---leading-trailing---")).toBe(
      "leading-trailing"
    );
  });

  it("handleCreateOrg calls organization.create and shows success toast", async () => {
    const { result } = renderHook(() => useOrganisation());

    act(() => {
      result.current.setOrgName("Test Org");
      result.current.setOrgSlug("test-org");
    });

    await act(async () => {
      await result.current.handleCreateOrg();
    });

    expect(mockOrgCreate).toHaveBeenCalledWith({
      name: "Test Org",
      slug: "test-org",
    });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" })
    );
    // Fields should be cleared
    expect(result.current.orgName).toBe("");
    expect(result.current.orgSlug).toBe("");
  });

  it("handleCreateOrg shows error toast on already exists", async () => {
    mockOrgCreate.mockResolvedValueOnce({
      error: { code: "ORGANIZATION_ALREADY_EXISTS", message: "Already exists" },
    });

    const { result } = renderHook(() => useOrganisation());

    act(() => {
      result.current.setOrgName("Dup Org");
      result.current.setOrgSlug("dup-org");
    });

    await act(async () => {
      await result.current.handleCreateOrg();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error" })
    );
  });

  it("handleLeaveOrg bails out when no activeOrg", async () => {
    const { result } = renderHook(() => useOrganisation());

    // activeOrg is null since SWR returns undefined
    await act(async () => {
      await result.current.handleLeaveOrg();
    });

    expect(mockOrgRemoveMember).not.toHaveBeenCalled();
  });
});

// ── useNotifications ────────────────────────────────────────────────────────

import { useNotifications } from "@/hooks/useNotifications";

describe("useNotifications", () => {
  const mockOnNavigate = vi.fn();
  const mockOnClose = vi.fn();
  const t = (key: string) => key;

  function setup() {
    return renderHook(() =>
      useNotifications({ t, onNavigate: mockOnNavigate, onClose: mockOnClose })
    );
  }

  it("renders without crashing and returns expected shape", () => {
    const { result } = setup();

    expect(result.current).toHaveProperty("notifications");
    expect(result.current).toHaveProperty("unreadCount");
    expect(result.current).toHaveProperty("handleMarkAllRead");
    expect(result.current).toHaveProperty("handleClearAll");
    expect(result.current).toHaveProperty("handleAcceptInvite");
    expect(result.current).toHaveProperty("handleRejectInvite");
    expect(Array.isArray(result.current.notifications)).toBe(true);
  });

  it("handleMarkAllRead calls notificationsApi.markAllRead and shows toast", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = setup();

    await act(async () => {
      await result.current.handleMarkAllRead();
    });

    expect(mockNotifMarkAllRead).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "allCaughtUpToast" })
    );
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));

    dispatchSpy.mockRestore();
  });

  it("handleClearAll does nothing if user cancels confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);

    const { result } = setup();

    await act(async () => {
      await result.current.handleClearAll();
    });

    expect(mockNotifClearAll).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("handleClearAll calls clearAll when user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const { result } = setup();

    await act(async () => {
      await result.current.handleClearAll();
    });

    expect(mockNotifClearAll).toHaveBeenCalled();
    expect(dispatchSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// ── useOrgMembers ───────────────────────────────────────────────────────────

import { useOrgMembers } from "@/hooks/useOrgMembers";

describe("useOrgMembers", () => {
  it("renders without crashing and returns members array", () => {
    const { result } = renderHook(() => useOrgMembers());

    expect(result.current).toHaveProperty("members");
    expect(result.current).toHaveProperty("isLoading");
    expect(Array.isArray(result.current.members)).toBe(true);
  });

  it("renders with roleFilter option without crashing", () => {
    const { result } = renderHook(() => useOrgMembers({ roleFilter: "admin" }));

    expect(Array.isArray(result.current.members)).toBe(true);
  });
});

// ── useUserRole ─────────────────────────────────────────────────────────────

import { useUserRole } from "@/hooks/useUserRole";

describe("useUserRole", () => {
  it("returns role from context when available", () => {
    const { result } = renderHook(() => useUserRole());

    // Context mock returns { role: "pm" }
    expect(result.current.role).toBe("pm");
    expect(result.current.loading).toBe(false);
  });

  it("returns session from authClient.useSession", () => {
    const { result } = renderHook(() => useUserRole());

    expect(result.current.session).toBeDefined();
    expect(result.current.session?.user?.id).toBe("user-1");
  });
});

// ── useSwrFieldAdapter ──────────────────────────────────────────────────────

import { useSwrFieldAdapter } from "@/lib/swr";

describe("useSwrFieldAdapter", () => {
  it("returns a dispatch function that calls mutate with field update", () => {
    const mockMutate = vi.fn();

    const { result } = renderHook(() =>
      useSwrFieldAdapter<{ items: string[] }, string[]>(mockMutate, "items")
    );

    act(() => {
      result.current(["a", "b"]);
    });

    expect(mockMutate).toHaveBeenCalledWith(expect.any(Function), {
      revalidate: false,
    });

    // Call the updater function passed to mutate to verify it updates the field
    const updaterFn = mockMutate.mock.calls[0][0];
    const updated = updaterFn({ items: ["old"], other: 1 });
    expect(updated).toEqual({ items: ["a", "b"], other: 1 });
  });
});
