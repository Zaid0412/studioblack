import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatShortDate,
  formatDate,
  formatShortDateTime,
  formatDateTime,
} from "@/lib/formatDate";
import {
  formatTimeAgo,
  formatTimeShort,
  timeAgo,
  relativeTime,
} from "@/lib/formatTime";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Pin time to 2026-04-16T12:00:00Z for deterministic assertions. */
const NOW = new Date("2026-04-16T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── formatShortDate ─────────────────────────────────────────────────────────

describe("formatShortDate", () => {
  it("formats with short month and day", () => {
    const result = formatShortDate("2026-04-11", "en-US");
    expect(result).toBe("Apr 11");
  });

  it("handles ISO timestamp strings", () => {
    const result = formatShortDate("2026-12-25T10:30:00Z", "en-US");
    expect(result).toBe("Dec 25");
  });
});

// ── formatDate ──────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("includes year", () => {
    const result = formatDate("2026-04-11", "en-US");
    expect(result).toBe("Apr 11, 2026");
  });

  it("formats a different year", () => {
    const result = formatDate("2025-01-01", "en-US");
    expect(result).toBe("Jan 1, 2025");
  });
});

// ── formatShortDateTime ─────────────────────────────────────────────────────

describe("formatShortDateTime", () => {
  it("includes date and time", () => {
    const result = formatShortDateTime("2026-04-11T14:30:00Z", "en-US");
    expect(result).toMatch(/Apr 11/);
    // Time depends on local timezone; just verify it contains a colon (h:mm)
    expect(result).toMatch(/\d+:\d{2}/);
  });

  it("does not include year", () => {
    const result = formatShortDateTime("2026-04-11T14:30:00Z", "en-US");
    expect(result).not.toContain("2026");
  });
});

// ── formatDateTime ──────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("includes year and time", () => {
    const result = formatDateTime("2026-04-11T14:30:00Z", "en-US");
    expect(result).toMatch(/Apr 11, 2026/);
    // Time depends on local timezone; just verify it contains h:mm
    expect(result).toMatch(/\d+:\d{2}/);
  });
});

// ── formatTimeAgo ───────────────────────────────────────────────────────────

describe("formatTimeAgo", () => {
  const t = vi.fn((key: string, values?: Record<string, unknown>) => {
    if (key === "justNow") return "just now";
    if (key === "hoursAgo") return `${values?.count}h ago`;
    if (key === "daysAgo") return `${values?.count}d ago`;
    return key;
  });

  beforeEach(() => {
    t.mockClear();
  });

  it("returns justNow for < 1 hour", () => {
    const thirtyMinAgo = new Date(NOW - 30 * 60 * 1000).toISOString();
    expect(formatTimeAgo(thirtyMinAgo, t)).toBe("just now");
    expect(t).toHaveBeenCalledWith("justNow");
  });

  it("returns hoursAgo for 1-23 hours", () => {
    const fiveHoursAgo = new Date(NOW - 5 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveHoursAgo, t)).toBe("5h ago");
    expect(t).toHaveBeenCalledWith("hoursAgo", { count: 5 });
  });

  it("returns daysAgo for 1-6 days", () => {
    const threeDaysAgo = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeDaysAgo, t)).toBe("3d ago");
    expect(t).toHaveBeenCalledWith("daysAgo", { count: 3 });
  });

  it("returns formatted date for 7+ days", () => {
    const tenDaysAgo = new Date(NOW - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatTimeAgo(tenDaysAgo, t);
    // Should fall back to formatShortDate, not call t()
    expect(result).not.toBe("just now");
    expect(t).not.toHaveBeenCalledWith("justNow");
  });
});

// ── formatTimeShort ─────────────────────────────────────────────────────────

describe("formatTimeShort", () => {
  it("formats time in h:mm pattern", () => {
    const result = formatTimeShort("2026-04-16T14:30:00Z", "en-US");
    // Timezone-dependent — just verify format
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
  });

  it("returns consistent format for different times", () => {
    const r1 = formatTimeShort("2026-04-16T09:05:00Z", "en-US");
    const r2 = formatTimeShort("2026-04-16T21:30:00Z", "en-US");
    // Both should match h:mm AM/PM pattern
    expect(r1).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    expect(r2).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/);
    expect(r1).not.toBe(r2);
  });
});

// ── timeAgo ─────────────────────────────────────────────────────────────────

describe("timeAgo", () => {
  it("returns 'just now' for < 1 minute", () => {
    const tenSecondsAgo = new Date(NOW - 10_000).toISOString();
    expect(timeAgo(tenSecondsAgo)).toBe("just now");
  });

  it("returns minutes for < 60 minutes", () => {
    const fiveMinAgo = new Date(NOW - 5 * 60_000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours for < 24 hours", () => {
    const threeHoursAgo = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days for < 30 days", () => {
    const twoDaysAgo = new Date(NOW - 2 * 86_400_000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("returns months for 30+ days", () => {
    const sixtyDaysAgo = new Date(NOW - 60 * 86_400_000).toISOString();
    expect(timeAgo(sixtyDaysAgo)).toBe("2mo ago");
  });
});

// ── relativeTime ────────────────────────────────────────────────────────────

describe("relativeTime", () => {
  it("uses minutes for < 60 min", () => {
    const fiveMinAgo = new Date(NOW - 5 * 60_000).toISOString();
    const result = relativeTime(fiveMinAgo, "en-US");
    // Intl.RelativeTimeFormat narrow: "5m ago"
    expect(result).toBe("5m ago");
  });

  it("uses hours for < 24 hours", () => {
    const threeHoursAgo = new Date(NOW - 3 * 3_600_000).toISOString();
    const result = relativeTime(threeHoursAgo, "en-US");
    expect(result).toBe("3h ago");
  });

  it("uses days for < 7 days", () => {
    const twoDaysAgo = new Date(NOW - 2 * 86_400_000).toISOString();
    const result = relativeTime(twoDaysAgo, "en-US");
    expect(result).toBe("2d ago");
  });

  it("falls back to formatted date for 7+ days", () => {
    const tenDaysAgo = new Date(NOW - 10 * 86_400_000).toISOString();
    const result = relativeTime(tenDaysAgo, "en-US");
    // Should be a short date like "Apr 6"
    expect(result).toMatch(/Apr/);
  });

  it("uses at least 1 minute for very recent timestamps", () => {
    const tenSecondsAgo = new Date(NOW - 10_000).toISOString();
    const result = relativeTime(tenSecondsAgo, "en-US");
    // diffMin < 60 branch with Math.max(1, diffMin) => 1 minute
    expect(result).toBe("1m ago");
  });
});
