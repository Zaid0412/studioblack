# User role badge — Implementation Plan

## Context

After signing in it's hard to tell **what role you hold** (PM / Architect / Client / Vendor).
Surface the **logged-in user's own role** as a small badge in two always-reachable spots:

- the **sidebar user area** (bottom-left — always visible while the sidebar is expanded), and
- the **account menu** (the popover that opens from that user row, and its mobile twin).

**Not** the page header. An earlier "You: [role]" chip beside the _Projects_ title was
prototyped and **dropped** — it repeats info the sidebar already shows and crowds the title.

This is the current user's **own** role only. Showing **every team member's** role per project
(a "Team" column on the projects list, colour-coded by role) was considered and **deferred** —
it's a separate, larger feature that needs per-project member data. (Prototyped as "Option 3".)

**Design reference:** `prejoin-redesigns.pen` → board **"User Role Display — Page Options"**,
the **"OPTION 1 + 2"** page (final refinement: sidebar user row + account menu, no header chip).

**Delivery:** one small PR off `main`. **No schema change, no API work** — the role is already in
client context (`useUserRole()` / the sidebar `variant`).

---

## 1. Role → label + colour

One source of truth in the new `RoleBadge` component.

| `UserRole`  | Label       | Colour        | Notes                               |
| ----------- | ----------- | ------------- | ----------------------------------- |
| `pm`        | `PM`        | accent gold   | `--accent` / `text-on-accent`       |
| `architect` | `Architect` | info blue     | `--info`                            |
| `client`    | `Client`    | purple        | **new** `--role-client` (`#a855f7`) |
| `vendor`    | `Vendor`    | success green | `--success`                         |

Purple isn't in the palette yet — add `--role-client` (light + dark) in `globals.css` and the two
theme configs, mapped to a `--color-role-client` Tailwind token. Keep the map **inside `RoleBadge`**
so callers never hand-pick colours.

> Open decision: **full label vs short** — `Architect` vs `Arch`, `Client` vs `Cl`. Default to full
> (fits the sidebar row and menu); switch to short only if the collapsed sidebar ever needs it.

---

## 2. Files to change

| File                                                           | Change                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/RoleBadge.tsx` **(new)**                    | `<RoleBadge role={UserRole} />` → a small pill. Owns the role→label→colour map (§1). Presentational, no data fetching. Optional `size`/`className` passthrough. Unknown role → render nothing (defensive).                                                                                                        |
| `src/components/layout/sidebar.tsx`                            | **(a)** User row (footer, ~L291): render `<RoleBadge role={variant} />` inline next to `{user.name}` (name + badge on one line, email below). **(b)** Account `PopoverContent` (~L303): add the role badge to the account section so it's reinforced where you manage the account. `variant` is already in scope. |
| `src/components/layout/AvatarMenu.tsx`                         | Profile header (~L59–62, under `{user.email}`): render `<RoleBadge role={role} />`. `role` already comes from `useUserRole()` (L25). This is the **mobile** account menu (used by `MobileTopBar`).                                                                                                                |
| `src/app/globals.css` + `src/config/themes/{light,default}.ts` | Add `--role-client` (`#a855f7`, tuned per theme) + `--color-role-client`. Only needed if we keep client = purple (recommended).                                                                                                                                                                                   |

**Role source per surface** (no new plumbing):

- Sidebar → the `variant` prop (`"pm" | "architect" | "client" | "vendor"`).
- AvatarMenu → `useUserRole()` (already imported).

---

## 3. i18n

Role labels under a `roles` namespace, so `RoleBadge` reads `useTranslations("roles")`:

| key               | en          | tr          |
| ----------------- | ----------- | ----------- |
| `roles.pm`        | `PM`        | `PM`        |
| `roles.architect` | `Architect` | `Mimar`     |
| `roles.client`    | `Client`    | `Müşteri`   |
| `roles.vendor`    | `Vendor`    | `Tedarikçi` |

(Confirm the Turkish with the team; these are reasonable defaults.)

---

## 4. Tests

- **Unit** (`role-badge` or a pure `roleBadgeMeta(role)` helper): every `UserRole` resolves to a
  label + colour token; an unknown value returns `null`/empty. Keep the map testable by exporting a
  plain `roleBadgeMeta()` function that the component renders from.
- RoleBadge itself is presentational — a DOM test is optional (skip unless the map lives in JSX).

---

## 5. Scope / non-goals

- ✅ Current user's **own** role, in the sidebar user area + account menu (desktop + mobile).
- ❌ **No** page-header chip (dropped after prototyping).
- ❌ **No** per-project team-roles column (Option 3) — separate, larger feature; deferred.
- ❌ No collapsed-sidebar (icon-only) badge — no room; revisit only if asked.

---

## 6. Rough sequence

1. `RoleBadge.tsx` + `roleBadgeMeta()` map + `--role-client` token + `roles.*` i18n.
2. Wire into `AvatarMenu.tsx` (smallest surface, validates the component).
3. Wire into `sidebar.tsx` (user row + account popover).
4. Unit test for the map; `npm run check`.

_Design lives in `prejoin-redesigns.pen` — "User Role Display — Page Options" → "OPTION 1 + 2"._
