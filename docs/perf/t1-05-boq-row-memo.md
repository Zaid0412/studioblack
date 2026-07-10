# Stabilize BOQ row handler props so `memo` actually holds

- **Tier / Impact / Effort:** T1 · Med · M
- **Area:** rendering
- **Files:** `src/app/(dashboard)/projects/[id]/boq/_components/BoqTable.tsx:383-385,663-665,727`, `src/app/(dashboard)/projects/[id]/_components/BoqTab.tsx:571`, `src/hooks/useBoqSelection.ts:52-59`, `src/lib/constants.ts:29`

## Problem

`BoqItemRow` is wrapped in `memo` (`BoqTable.tsx:727`) but three props get a **fresh identity every render**, defeating memoization so every row re-renders on any BoqTab state change:

1. `BoqTab.tsx:571` — `onDeleteItem={async (item) => requestDeleteItem(item)}` is an inline arrow recreated each render, passed down through `BoqTable` to every row (`BoqTable.tsx:378,656`).
2. `BoqTable.tsx:383-385` — `onRequestChangeComment={(item, target) => setChangeRequestTarget({ item, target })}` inline arrow, threaded to every row (`BoqTable.tsx:661`).
3. `BoqTable.tsx:663-665` — `onToggleSelected={selection ? () => selection.toggle(item.id) : undefined}` builds a **new per-row closure** on every render even though `selection.toggle` itself is stable (`useBoqSelection.ts:52`, `useCallback`).

BOQ is not paginated — up to `DEFAULT_PAGE_LIMIT = 200` items (`constants.ts:29`) render at once. Any state change in `BoqTab` (a checkbox tick, a filter toggle, opening a dialog) re-renders all rows, each re-running `getLegalPhaseTransitions`, margin-tier computation, grid-class derivation, and ~10 `BoqEditableCell` children.

Note: `updateItem` / `moveItem` passed as `onUpdateItem` / `onMoveItem` are already stable (`useBoqMutations` `useCallback`), so only the three above need fixing.

## Fix

1. **`BoqTab.tsx:571`** — wrap the delete handler in `useCallback` (it only depends on the stable `requestDeleteItem`; make that a `useCallback` too if it isn't):

```ts
const handleDeleteItem = useCallback(
  (item: BoqItemWithComputed) => requestDeleteItem(item),
  [requestDeleteItem]
);
// ...
onDeleteItem = { handleDeleteItem };
```

2. **`BoqTable.tsx:383`** — hoist the change-comment handler to a `useCallback` inside `BoqTable`:

```ts
const handleRequestChangeComment = useCallback(
  (item: BoqItemWithComputed, target: BoqItemPhase) =>
    setChangeRequestTarget({ item, target }),
  []
);
// pass handleRequestChangeComment instead of the inline arrow
```

3. **`BoqTable.tsx:663-665`** — stop minting a per-row closure. `BoqItemRow` already receives `item`, so change `onToggleSelected` to take the id from the row itself and pass the stable `selection.toggle`. Update the prop type on `BoqItemRowProps` (`BoqTable.tsx:706`) from `onToggleSelected?: () => void` to `onToggleSelected?: (id: string) => void`, and have the row's checkbox call `onToggleSelected(item.id)`. Then at the call site:

```ts
onToggleSelected={selection ? selection.toggle : undefined}
isSelected={selection ? selection.selected.has(item.id) : false}
```

`selection.toggle` is already `useCallback`-stable (`useBoqSelection.ts:52`), so the prop identity is now constant across rows and renders. (`isSelected` is a boolean primitive — fine for `memo`.)

## Verification

- React DevTools Profiler: enter selection mode, tick one row's checkbox — confirm **only that row** re-renders (plus the section header tri-state), not all 200 rows. Repeat for a filter toggle.
- No behavior change: delete, change-request, and multi-select flows still work end-to-end.
- Add/extend a hook test in `src/test/unit/` for `useBoqSelection` asserting `toggle` identity is stable across renders (guards against regression).
- `npm run check` green (the `onToggleSelected` signature change touches the row prop type + checkbox call site).

## Risks / notes

- The signature change on `onToggleSelected` must be applied at both the type (`BoqItemRowProps`) and the row's internal checkbox handler, or tsc will flag it — that's the intended safety net.
- Real win scales with item count; on small BOQs it's negligible but harmless.
- Does not add pagination — that's a separate, larger change; this fix makes the existing full-render list cheap enough that it isn't needed yet.
