// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";

/* ─── Imports ─── */

import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";

/* ────────────────────────────────────────────────────────────
 * Pagination
 * ──────────────────────────────────────────────────────────── */

describe("Pagination", () => {
  const onPageChange = vi.fn();

  beforeEach(() => {
    onPageChange.mockClear();
  });

  afterEach(cleanup);

  it("renders all page numbers when totalPages <= 7", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeDefined();
    }
    // No ellipsis
    expect(screen.queryByText("\u2026")).toBeNull();
  });

  it("renders a single page when totalPages = 1", () => {
    render(
      <Pagination currentPage={1} totalPages={1} onPageChange={onPageChange} />
    );
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.queryByText("2")).toBeNull();
  });

  it("shows ellipsis near end when currentPage = 1 and totalPages > 7", () => {
    render(
      <Pagination currentPage={1} totalPages={20} onPageChange={onPageChange} />
    );
    // Should show page 1, 2, ellipsis, 20
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("20")).toBeDefined();
    // One ellipsis (between page 2 and 20)
    const ellipses = screen.getAllByText("\u2026");
    expect(ellipses.length).toBe(1);
  });

  it("shows ellipsis on both sides when currentPage is in the middle", () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={onPageChange}
      />
    );
    // Should show 1, ..., 9, 10, 11, ..., 20
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("9")).toBeDefined();
    expect(screen.getByText("10")).toBeDefined();
    expect(screen.getByText("11")).toBeDefined();
    expect(screen.getByText("20")).toBeDefined();
    const ellipses = screen.getAllByText("\u2026");
    expect(ellipses.length).toBe(2);
  });

  it("shows ellipsis near start when currentPage is last page", () => {
    render(
      <Pagination
        currentPage={20}
        totalPages={20}
        onPageChange={onPageChange}
      />
    );
    // Should show 1, ..., 19, 20
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.getByText("19")).toBeDefined();
    expect(screen.getByText("20")).toBeDefined();
    const ellipses = screen.getAllByText("\u2026");
    expect(ellipses.length).toBe(1);
  });

  it("disables Prev button on page 1", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />
    );
    expect(
      screen.getByLabelText("Previous page").hasAttribute("disabled")
    ).toBe(true);
  });

  it("disables Next button on last page", () => {
    render(
      <Pagination currentPage={5} totalPages={5} onPageChange={onPageChange} />
    );
    expect(screen.getByLabelText("Next page").hasAttribute("disabled")).toBe(
      true
    );
  });

  it("calls onPageChange when a page number is clicked", () => {
    render(
      <Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(onPageChange).toHaveBeenCalledTimes(1);
  });
});

/* ────────────────────────────────────────────────────────────
 * SearchInput
 * ──────────────────────────────────────────────────────────── */

describe("SearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("calls onChange immediately when debounceMs is not set", () => {
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} placeholder="Search" />);
    const input = screen.getByPlaceholderText("Search");

    fireEvent.change(input, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onDebouncedChange after the debounce delay", () => {
    const onDebouncedChange = vi.fn();
    render(
      <SearchInput
        debounceMs={300}
        onDebouncedChange={onDebouncedChange}
        placeholder="Search"
      />
    );
    const input = screen.getByPlaceholderText("Search");

    fireEvent.change(input, { target: { value: "hello" } });
    expect(onDebouncedChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onDebouncedChange).toHaveBeenCalledWith("hello");
    expect(onDebouncedChange).toHaveBeenCalledTimes(1);
  });

  it("resets the debounce timer on rapid typing (only last value fires)", () => {
    const onDebouncedChange = vi.fn();
    render(
      <SearchInput
        debounceMs={300}
        onDebouncedChange={onDebouncedChange}
        placeholder="Search"
      />
    );
    const input = screen.getByPlaceholderText("Search");

    fireEvent.change(input, { target: { value: "h" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: "he" } });
    vi.advanceTimersByTime(100);
    fireEvent.change(input, { target: { value: "hel" } });
    vi.advanceTimersByTime(100);
    // 300ms since last keystroke hasn't passed yet
    expect(onDebouncedChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onDebouncedChange).toHaveBeenCalledWith("hel");
    expect(onDebouncedChange).toHaveBeenCalledTimes(1);
  });

  it("clears pending timer on unmount (no error after unmount)", () => {
    const onDebouncedChange = vi.fn();
    const { unmount } = render(
      <SearchInput
        debounceMs={300}
        onDebouncedChange={onDebouncedChange}
        placeholder="Search"
      />
    );
    const input = screen.getByPlaceholderText("Search");

    fireEvent.change(input, { target: { value: "hello" } });
    unmount();

    // Advancing timers after unmount should not throw or call the callback
    vi.advanceTimersByTime(500);
    expect(onDebouncedChange).not.toHaveBeenCalled();
  });
});
