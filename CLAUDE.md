# StudioBlack

Architectural design review and approval platform for interior design studios. Manages full project lifecycle: design layouts, reviews, approvals, handover. Three roles: PM, Architect, Client.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, Server Components)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4, Radix UI primitives (shadcn pattern), Lucide icons
- **Auth:** better-auth (email/password + magic link + organization plugin)
- **Database:** PostgreSQL (Supabase) via raw `pg` driver — no ORM
- **Storage:** Supabase Storage (50MB limit)
- **Email:** Nodemailer + Brevo SMTP
- **i18n:** next-intl (en, tr)
- **Data Fetching:** SWR (stale-while-revalidate caching)
- **Validation:** Zod v4
- **Deployment:** Vercel

## Architecture

### Database

Raw SQL via `pg` Pool singleton (`src/lib/db.ts`). All queries in `src/lib/queries.ts`. No ORM — use `pool.query()` with parameterized queries.

Migrations are manual SQL files in `scripts/` run via `psql`. better-auth tables use `npx @better-auth/cli migrate`.

### Auth Flow

1. Edge middleware (`src/middleware.ts`): cookie-presence check
2. Dashboard layout: full session validation via `auth.api.getSession()`
3. API routes: `withAuth()` wrapper (CSRF, role, project-access checks)

Roles: org owner/admin = PM, org member = architect, no org + client_email match = client.

### API Pattern

Route Handlers in `src/app/api/` wrapped with `withAuth()`. Client-side fetch via typed wrappers in `src/lib/api/`.

**Client-side API structure (`src/lib/api/`):**

- `client.ts` — base `apiGet`, `apiPost`, `apiPatch`, `apiDelete` wrappers with typed responses and `ApiError` class
- `routes.ts` — `API` object with URL builder functions (e.g., `API.tasks()` → `"/api/tasks"`, `API.project(id)` → `"/api/projects/${id}"`)
- Domain files (`tasks.ts`, `notifications.ts`, `attachments.ts`, etc.) — export typed functions using the base wrappers + route builders
- `index.ts` — re-exports all domain modules (use `import { tasks, notifications } from "@/lib/api"`)

When adding a new API endpoint: add the route to `routes.ts`, create or extend the domain file, use `apiGet`/`apiPost`/etc. from `client.ts`.

### State Management

No global store. React Context for sidebar/theme/user role. Custom hooks (`useProjectList`, `useTaskCrud`, etc.) with SWR or `useState`/`useCallback` + API fetches.

### Data Fetching

- **SWR** is the default for GET requests. Global `SWRConfig` is set in the dashboard layout (`src/components/providers/SWRProvider.tsx`) with `revalidateOnFocus: true` and `dedupingInterval: 5000`.
- Use `useSWR<T>("/api/endpoint")` instead of manual `useState` + `useEffect` + `fetch` for read operations. The global fetcher (`src/lib/swr.ts`) uses `apiGet` from `src/lib/api/client.ts`.
- For mutations, call the API wrapper then `mutate()` the SWR cache key.
- Complex hooks with polling or multi-resource mutations may still use manual fetching — migrate to SWR incrementally.

### User Role

- `UserRoleProvider` in the dashboard layout passes the server-derived role to all child pages via context (`src/contexts/UserRoleContext.tsx`).
- `useUserRole()` reads from context instantly — no API call needed. Falls back to client-side derivation if used outside the provider.
- Never call `getFullOrganization()` client-side just to determine the user's role — use `useUserRole()` instead.

### Polling

- Any `setInterval`-based polling must use `usePageVisibility()` (`src/hooks/usePageVisibility.ts`) to pause when the tab is hidden and resume + immediate fetch when visible.
- Never poll unconditionally — always gate on visibility.

### Notifications

- Toast: `import { toast } from "@/components/ui/useToast"` — custom hook, not a library. Do not import from `sonner`, `react-hot-toast`, or similar.
- Cross-component refresh: dispatch `window.dispatchEvent(new Event("notifications-changed"))` after any mutation that affects notification state (mark read, clear, delete, accept/reject invite). The `useNotifications` hook listens for this event to refetch.

### File Versioning

- Attachments support versioning via `version_group` (UUID). All versions of a file share the same `version_group`.
- `version_number` is auto-incremented per group. The latest version is the one with the highest `version_number`.
- Use `attachmentsApi.getVersionHistory(projectId, versionGroup)` to fetch all versions of a file.
- When uploading a new version, pass the existing `version_group` to link it to the original file.

### Performance

- Filter data on the server (SQL) instead of fetching everything and filtering client-side. Example: `getTasks` accepts `phaseId` in `TaskFilters` to filter at the DB level.
- Use `next/image` instead of raw `<img>` tags for static/known-dimension images (WebP conversion, lazy loading, responsive sizing). Exception: images that need `onLoadStart`/`onError` handlers or must not be re-compressed (design review files).

## Key Files

- `src/lib/queries.ts` — all SQL queries
- `src/lib/withAuth.ts` — API auth wrapper
- `src/lib/permissions.ts` — RBAC definitions
- `src/lib/constants.ts` — project phases (6) and workflow steps (7)
- `src/config/branding.ts` — app name, logo, tagline
- `src/config/features.ts` — feature flags
- `src/types/index.ts` — all shared TypeScript types
- `src/app/globals.css` — CSS variables + Tailwind v4 theme
- `src/lib/swr.ts` — SWR global config + fetcher
- `src/contexts/UserRoleContext.tsx` — UserRole provider + context hook
- `src/test/setup.ts` — global test mocks for all external boundaries
- `src/test/helpers.ts` — test factories (mockSession, buildRequest, parseResponse)
- `vitest.config.ts` — Vitest configuration (node env, API/unit tests)
- `vitest.config.hooks.ts` — Vitest configuration (jsdom env, React hook tests)
- `src/hooks/usePageVisibility.ts` — Page Visibility API hook for polling gates
- `playwright.config.ts` — Playwright E2E test configuration
- `e2e/global-setup.ts` — E2E auth setup (login + save storage state per role)
- `scripts/seed-e2e.ts` — Seed E2E test users with verified emails
- `scripts/cleanup-e2e.ts` — Clean up E2E test data from database

## Project Domain

### Phases (design sections per project)

1. 2D Layout / Adaptation
2. 3D Layout / Adaptation
3. Production Plan
4. Section View
5. Plumbing Section View
6. Floor Plans

### Workflow Steps

Recce → Design → BOQ → Order → Work Progress → Snag → Finance

### File Review Flow

Upload → Pending Review → Approved/Rejected (with annotations) → Design Freeze

## Scripts

- `npm run dev` — dev server (webpack)
- `npm run check` — lint + format check + tsc
- `npm run seed` — seed test users
- `npm test` — run API/unit tests (Vitest, node environment)
- `npm run test:hooks` — run React hook tests (Vitest, jsdom environment)
- `npm run test:all` — run both test suites
- `npm run test:watch` — run tests in watch mode
- `npm run test:coverage` — run tests with coverage report
- `npm run seed:e2e` — seed E2E test users (requires running database)
- `npm run cleanup:e2e` — remove E2E test data from database
- `npm run test:e2e` — run Playwright E2E tests (requires dev server)
- `npm run test:e2e:ui` — run E2E tests with Playwright UI mode
- `npm run test:e2e:headed` — run E2E tests in headed browser

## Rules

- Write DRY code. Before adding new helpers, components, or utilities, check if something similar already exists. Extract shared logic instead of duplicating it.
- Do NOT append `Co-Authored-By` lines to commit messages.
- All database queries use raw SQL with parameterized values — never use string interpolation.
- better-auth tables use camelCase columns (`userId`, `organizationId`). App tables use snake_case.
- Unit/API tests use Vitest. API route tests are in `src/test/api/`, unit tests in `src/test/unit/`. Global mocks (db, auth, email, storage) are in `src/test/setup.ts`, helpers in `src/test/helpers.ts`. When adding a new API route, add a corresponding test file. When adding a new Zod schema, add validation tests.
- E2E tests use Playwright in `e2e/`. Auth storage states are saved per role in `e2e/.auth/`. Test users use `e2e-*@test.studioblack.com` email pattern. Config is in `playwright.config.ts`. CI workflow is `.github/workflows/e2e.yml`.
- Always use custom UI components from `src/components/ui/` instead of native HTML elements. Check what exists before writing raw `<select>`, `<input type="date">`, `<input type="checkbox">`, tooltips (`title=`), etc. Key components: `Select`, `DatePicker`, `Calendar`, `Checkbox`, `Tooltip`, `Input`, `Button`, `Popover`, `ToggleSwitch`.
- Use `useSWR` for new GET-based data fetching — not manual `useState` + `useEffect` + `fetch`.
- Use `useUserRole()` for role checks — never derive role client-side via `getFullOrganization()`.
- Any polling interval must be gated on `usePageVisibility()` — no unconditional `setInterval`.
- Prefer server-side filtering (add params to `queries.ts` + API route) over client-side `Array.filter` on large datasets.
- Use `next/image` for static images with known dimensions. Keep raw `<img>` only when `next/image` doesn't support required handlers.
