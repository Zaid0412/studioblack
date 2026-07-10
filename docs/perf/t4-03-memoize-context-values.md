# Memoize ThemeProvider and SidebarContext values

- **Tier / Impact / Effort:** T4 · Low · S
- **Area:** rendering
- **Files:** `src/components/ThemeProvider.tsx:107`, `src/components/layout/SidebarContext.tsx:31`, `src/contexts/UserRoleContext.tsx:31` (reference)

## Problem

Two context providers allocate a fresh value object on every render:

- `src/components/ThemeProvider.tsx:107` — `<ThemeContext.Provider value={{ theme, mode, toggleTheme }}>`
- `src/components/layout/SidebarContext.tsx:31` — `<SidebarContext.Provider value={{ isCollapsed, toggle, collapse }}>`

A new object identity forces every consumer of the context to re-render whenever the provider re-renders, even if the underlying values are unchanged.

Impact here is genuinely **low**: each provider's only state _is_ the value it exposes (`ThemeProvider` holds `mode`; `SidebarProvider` holds `isCollapsed`), and `toggleTheme` / `toggle` / `collapse` are already wrapped in `useCallback` with stable identities. So the provider only re-renders when the value actually changes — there's no re-render storm to eliminate today. `theme` in `ThemeProvider` is derived (`mode === "dark" ? defaultTheme : lightTheme`) and is already referentially stable per mode.

This is a **consistency / hygiene** fix, not a hot-path optimization. `src/contexts/UserRoleContext.tsx:31` already does the correct thing (`useMemo(() => ({ role, userId, orgRole }), [role, userId, orgRole])`). The value of fixing the other two is that if future state is added to either provider (e.g. sidebar width, theme accent), the un-memoized object would then leak unnecessary re-renders — memoizing now makes them safe by construction and consistent with `UserRoleContext`.

## Fix

`ThemeProvider.tsx` — wrap the value in `useMemo` (imports already include `useMemo`? no — currently imports `useCallback`, `useContext`, `useEffect`, `useState`; add `useMemo`):

```tsx
const value = useMemo(
  () => ({ theme, mode, toggleTheme }),
  [theme, mode, toggleTheme]
);
return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
```

`SidebarContext.tsx` — add `useMemo` to the import and wrap:

```tsx
const value = useMemo(
  () => ({ isCollapsed, toggle, collapse }),
  [isCollapsed, toggle, collapse]
);
return (
  <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
);
```

The handlers (`toggle`, `collapse`, `toggleTheme`) are already `useCallback`-wrapped, so no additional changes are needed there.

## Verification

- No behavior change: theme toggle and sidebar collapse/expand still work identically.
- `npm run check` passes (new `useMemo` import used; no unused-var lint).
- Optional: confirm both providers now match the `UserRoleContext` pattern for consistency.

## Risks / notes

- Negligible risk — pure referential-stability refactor.
- Do not over-sell this as a perf win; frame it as hygiene/consistency. It matters only if/when these providers gain additional state.
