/**
 * Generic helpers for the self-referencing category trees used across the app
 * (element categories, vendor categories, …). Keeps the build/flatten logic in
 * one place so each taxonomy's query/UI layer doesn't reimplement it.
 */

/**
 * Build a nested tree from flat rows linked by `parent_id`. A row whose
 * `parent_id` references a row not present in the input is dropped (neither a
 * root nor attached) — callers pass a complete org-scoped set.
 */
export function buildTreeFromFlat<
  T extends { id: string; parent_id: string | null },
  N extends T & { children: N[] },
>(rows: T[]): N[] {
  const map = new Map<string, N>();
  const roots: N[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] } as unknown as N);
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else if (!node.parent_id) {
      roots.push(node);
    }
  }

  return roots;
}

/** Depth-first flatten of a nested tree into `{ node, depth }` rows for indented rendering. */
export function flattenTree<N extends { children: N[] }>(
  nodes: N[],
  depth = 0
): { node: N; depth: number }[] {
  const out: { node: N; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children.length > 0) out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}
