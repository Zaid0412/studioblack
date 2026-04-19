// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProjectList, type ProjectListItem } from "@/hooks/useProjectList";

// ── Fixtures ────────────────────────────────────────────────────────────────

const projects: ProjectListItem[] = [
  {
    name: "Alpha",
    status: "active",
    created_at: "2026-01-15T10:00:00Z",
    updated_at: "2026-04-01T10:00:00Z",
  },
  {
    name: "Beta",
    status: "completed",
    created_at: "2026-02-20T10:00:00Z",
    updated_at: "2026-03-15T10:00:00Z",
  },
  {
    name: "Charlie",
    status: "active",
    created_at: "2026-03-10T10:00:00Z",
    updated_at: null,
  },
  {
    name: "Delta",
    status: "draft",
    created_at: "2026-04-01T10:00:00Z",
    updated_at: "2026-04-10T10:00:00Z",
  },
];

// ── useProjectList ──────────────────────────────────────────────────────────

describe("useProjectList", () => {
  it("returns all items by default, sorted newest first", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    expect(result.current.filtered).toHaveLength(4);
    expect(result.current.filtered[0].name).toBe("Delta");
    expect(result.current.filtered[3].name).toBe("Alpha");
  });

  it("filters by search (case-insensitive)", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setSearch("alpha");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe("Alpha");
  });

  it("filters by activeFilter tab", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setActiveFilter("completed");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe("Beta");
  });

  it("filters by statusFilter", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setStatusFilter("draft");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe("Delta");
  });

  it("combines search and filter", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setActiveFilter("active");
      result.current.setSearch("charlie");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe("Charlie");
  });

  it("sorts by oldest", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setSortBy("oldest");
    });

    expect(result.current.filtered[0].name).toBe("Alpha");
    expect(result.current.filtered[3].name).toBe("Delta");
  });

  it("sorts by name", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setSortBy("name");
    });

    expect(result.current.filtered[0].name).toBe("Alpha");
    expect(result.current.filtered[1].name).toBe("Beta");
    expect(result.current.filtered[2].name).toBe("Charlie");
    expect(result.current.filtered[3].name).toBe("Delta");
  });

  it("sorts by updated (falls back to created_at when null)", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setSortBy("updated");
    });

    // Delta (Apr 10) > Alpha (Apr 1) > Charlie (Mar 10 from created_at) > Beta (Mar 15)
    expect(result.current.filtered[0].name).toBe("Delta");
    expect(result.current.filtered[1].name).toBe("Alpha");
  });

  it("paginates results (10 per page)", () => {
    // Create 15 items
    const manyProjects: ProjectListItem[] = Array.from(
      { length: 15 },
      (_, i) => ({
        name: `Project ${String(i).padStart(2, "0")}`,
        status: "active",
        created_at: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      })
    );

    const { result } = renderHook(() =>
      useProjectList({ items: manyProjects })
    );

    expect(result.current.paginatedRows).toHaveLength(10);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.startIdx).toBe(0);
    expect(result.current.endIdx).toBe(10);

    act(() => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.paginatedRows).toHaveLength(5);
    expect(result.current.startIdx).toBe(10);
  });

  it("resets page to 1 when filters change", () => {
    const manyProjects: ProjectListItem[] = Array.from(
      { length: 15 },
      (_, i) => ({
        name: `Project ${i}`,
        status: "active",
        created_at: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      })
    );

    const { result } = renderHook(() =>
      useProjectList({ items: manyProjects })
    );

    act(() => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.setSearch("Project 1");
    });

    expect(result.current.currentPage).toBe(1);
  });

  it("returns activeTabCount matching filtered length", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setActiveFilter("active");
    });

    expect(result.current.activeTabCount).toBe(2);
    expect(result.current.activeTabCount).toBe(result.current.filtered.length);
  });

  it("accepts custom searchFilter", () => {
    const customSearch = (item: ProjectListItem, query: string) =>
      item.status.includes(query);

    const { result } = renderHook(() =>
      useProjectList({ items: projects, searchFilter: customSearch })
    );

    act(() => {
      result.current.setSearch("draft");
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].name).toBe("Delta");
  });

  it("returns totalPages of at least 1 for empty results", () => {
    const { result } = renderHook(() => useProjectList({ items: projects }));

    act(() => {
      result.current.setSearch("nonexistent");
    });

    expect(result.current.filtered).toHaveLength(0);
    expect(result.current.totalPages).toBe(1);
  });
});
