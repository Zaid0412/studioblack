import { describe, it, expect, vi } from "vitest";

vi.unmock("@/lib/queries");
import { escapeSqlLike } from "@/lib/queries";

describe("escapeSqlLike", () => {
  it("escapes percent wildcard", () => {
    expect(escapeSqlLike("100%")).toBe("100\\%");
  });

  it("escapes underscore wildcard", () => {
    expect(escapeSqlLike("user_name")).toBe("user\\_name");
  });

  it("escapes backslash", () => {
    expect(escapeSqlLike("path\\file")).toBe("path\\\\file");
  });

  it("escapes mixed special characters", () => {
    expect(escapeSqlLike("100%_done\\here")).toBe("100\\%\\_done\\\\here");
  });

  it("returns empty string unchanged", () => {
    expect(escapeSqlLike("")).toBe("");
  });

  it("returns string with no special chars unchanged", () => {
    expect(escapeSqlLike("hello world")).toBe("hello world");
  });
});
