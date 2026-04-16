import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must unmock since setup.ts mocks it
vi.unmock("@/lib/logger");

import { logger } from "@/lib/logger";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("logger", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    (["log", "warn", "error", "debug"] as const).forEach((method) => {
      vi.spyOn(console, method).mockImplementation(() => {});
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ── Level filtering ───────────────────────────────────────────────────

  describe("level filtering", () => {
    it("logs all levels when LOG_LEVEL=debug", () => {
      process.env.LOG_LEVEL = "debug";
      process.env.NODE_ENV = "development";

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("filters debug when LOG_LEVEL=info", () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "development";

      logger.debug("should not appear");
      logger.info("should appear");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it("filters debug and info when LOG_LEVEL=warn", () => {
      process.env.LOG_LEVEL = "warn";
      process.env.NODE_ENV = "development";

      logger.debug("no");
      logger.info("no");
      logger.warn("yes");
      logger.error("yes");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("only logs errors when LOG_LEVEL=error", () => {
      process.env.LOG_LEVEL = "error";
      process.env.NODE_ENV = "development";

      logger.debug("no");
      logger.info("no");
      logger.warn("no");
      logger.error("yes");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("defaults to info in production", () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "production";

      logger.debug("no");
      logger.info("yes");

      // Production uses console.log with JSON for all levels
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it("defaults to debug in development", () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "development";

      logger.debug("yes");

      expect(console.debug).toHaveBeenCalledTimes(1);
    });
  });

  // ── Output format ─────────────────────────────────────────────────────

  describe("output format", () => {
    it("outputs JSON in production", () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "production";

      logger.info("hello");

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("hello");
      expect(parsed.timestamp).toBeDefined();
    });

    it("outputs readable format in development", () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "development";

      logger.info("hello");

      expect(console.log).toHaveBeenCalledWith("[INFO] hello");
    });

    it("includes context in dev format", () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "development";

      logger.info("hello", { userId: "u1" });

      expect(console.log).toHaveBeenCalledWith(
        "[INFO] hello",
        expect.objectContaining({ userId: "u1" })
      );
    });
  });

  // ── Error serialization ───────────────────────────────────────────────

  describe("error serialization", () => {
    it("serializes Error instances in context", () => {
      process.env.LOG_LEVEL = "error";
      process.env.NODE_ENV = "production";

      const err = new Error("boom");
      logger.error("failed", { error: err });

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.errorMessage).toBe("boom");
      expect(parsed.errorStack).toBeDefined();
    });

    it("serializes Error with cause", () => {
      process.env.LOG_LEVEL = "error";
      process.env.NODE_ENV = "production";

      const err = new Error("outer", { cause: "inner reason" });
      logger.error("failed", { error: err });

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.errorMessage).toBe("outer");
      expect(parsed.errorCause).toBe("inner reason");
    });

    it("handles non-Error values in context", () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "production";

      logger.info("msg", { count: 42, flag: true });

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.count).toBe(42);
      expect(parsed.flag).toBe(true);
    });
  });
});
