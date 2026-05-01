import { describe, it, expect, vi, beforeEach } from "vitest";
import { deriveEffectiveRole } from "@/lib/effectiveRole";
import { getMemberRole } from "@/lib/queries";

const mockedGetMemberRole = vi.mocked(getMemberRole);

describe("deriveEffectiveRole", () => {
  beforeEach(() => {
    mockedGetMemberRole.mockReset();
  });

  it("returns 'client' when DB role is 'client', regardless of org role", async () => {
    mockedGetMemberRole.mockResolvedValue("owner");
    expect(await deriveEffectiveRole("u1", "org1", "client")).toBe("client");
  });

  it("returns 'vendor' when DB role is 'vendor', regardless of org role", async () => {
    mockedGetMemberRole.mockResolvedValue("admin");
    expect(await deriveEffectiveRole("u1", "org1", "vendor")).toBe("vendor");
  });

  it("returns 'pm' for owner/admin org members", async () => {
    mockedGetMemberRole.mockResolvedValueOnce("owner");
    expect(await deriveEffectiveRole("u1", "org1", "pm")).toBe("pm");
    mockedGetMemberRole.mockResolvedValueOnce("admin");
    expect(await deriveEffectiveRole("u1", "org1", "pm")).toBe("pm");
  });

  it("returns 'architect' for member org role", async () => {
    mockedGetMemberRole.mockResolvedValue("member");
    expect(await deriveEffectiveRole("u1", "org1", "pm")).toBe("architect");
  });

  it("returns 'vendor' for vendor org role", async () => {
    mockedGetMemberRole.mockResolvedValue("vendor");
    expect(await deriveEffectiveRole("u1", "org1", "pm")).toBe("vendor");
  });

  it("returns 'client' for client org role", async () => {
    mockedGetMemberRole.mockResolvedValue("client");
    expect(await deriveEffectiveRole("u1", "org1", "pm")).toBe("client");
  });

  it("falls back to DB role when there is no org", async () => {
    expect(await deriveEffectiveRole("u1", null, "pm")).toBe("pm");
    expect(await deriveEffectiveRole("u1", null, "vendor")).toBe("vendor");
    expect(await deriveEffectiveRole("u1", null, null)).toBe("pm");
  });
});
