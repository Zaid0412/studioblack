import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Must unmock since setup.ts mocks it
vi.unmock("@/lib/logger");

// ── Helpers ─────────────────────────────────────────────────────────────────

let logger: typeof import("@/lib/logger").logger;

/** Re-import logger with a fresh module to pick up env changes. */
async function loadLogger() {
  vi.resetModules();
  const mod = await import("@/lib/logger");
  logger = mod.logger;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("logger", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ── Level filtering ───────────────────────────────────────────────────

  describe("level filtering", () => {
    it("logs all levels when LOG_LEVEL=debug", async () => {
      process.env.LOG_LEVEL = "debug";
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("filters debug when LOG_LEVEL=info", async () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.debug("should not appear");
      logger.info("should appear");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it("filters debug and info when LOG_LEVEL=warn", async () => {
      process.env.LOG_LEVEL = "warn";
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.debug("no");
      logger.info("no");
      logger.warn("yes");
      logger.error("yes");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("only logs errors when LOG_LEVEL=error", async () => {
      process.env.LOG_LEVEL = "error";
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.debug("no");
      logger.info("no");
      logger.warn("no");
      logger.error("yes");

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("defaults to info in production", async () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "production";
      await loadLogger();

      logger.debug("no");
      logger.info("yes");

      // Production uses console.log with JSON for all levels
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it("defaults to debug in development", async () => {
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.debug("yes");

      expect(console.debug).toHaveBeenCalledTimes(1);
    });
  });

  // ── Output format ─────────────────────────────────────────────────────

  describe("output format", () => {
    it("outputs JSON in production", async () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "production";
      await loadLogger();

      logger.info("hello");

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("hello");
      expect(parsed.timestamp).toBeDefined();
    });

    it("outputs readable format in development", async () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.info("hello");

      expect(console.log).toHaveBeenCalledWith("[INFO] hello");
    });

    it("includes context in dev format", async () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "development";
      await loadLogger();

      logger.info("hello", { userId: "u1" });

      expect(console.log).toHaveBeenCalledWith(
        "[INFO] hello",
        expect.objectContaining({ userId: "u1" })
      );
    });
  });

  // ── Error serialization ───────────────────────────────────────────────

  describe("error serialization", () => {
    it("serializes Error instances in context", async () => {
      process.env.LOG_LEVEL = "error";
      process.env.NODE_ENV = "production";
      await loadLogger();

      const err = new Error("boom");
      logger.error("failed", { error: err });

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.errorMessage).toBe("boom");
      expect(parsed.errorStack).toBeDefined();
    });

    it("serializes Error with cause", async () => {
      process.env.LOG_LEVEL = "error";
      process.env.NODE_ENV = "production";
      await loadLogger();

      const err = new Error("outer", { cause: "inner reason" });
      logger.error("failed", { error: err });

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.errorMessage).toBe("outer");
      expect(parsed.errorCause).toBe("inner reason");
    });

    it("handles non-Error values in context", async () => {
      process.env.LOG_LEVEL = "info";
      process.env.NODE_ENV = "production";
      await loadLogger();

      logger.info("msg", { count: 42, flag: true });

      const call = vi.mocked(console.log).mock.calls[0][0] as string;
      const parsed = JSON.parse(call);
      expect(parsed.count).toBe(42);
      expect(parsed.flag).toBe(true);
    });
  });
});
