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

### State Management

No global store. React Context for sidebar/theme. Custom hooks (`useProjectList`, `useTaskCrud`, etc.) with `useState`/`useCallback` + API fetches.

## Key Files

- `src/lib/queries.ts` — all SQL queries
- `src/lib/withAuth.ts` — API auth wrapper
- `src/lib/permissions.ts` — RBAC definitions
- `src/lib/constants.ts` — project phases (6) and workflow steps (7)
- `src/config/branding.ts` — app name, logo, tagline
- `src/config/features.ts` — feature flags
- `src/types/index.ts` — all shared TypeScript types
- `src/app/globals.css` — CSS variables + Tailwind v4 theme

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

## Rules

- Do NOT append `Co-Authored-By` lines to commit messages.
- All database queries use raw SQL with parameterized values — never use string interpolation.
- better-auth tables use camelCase columns (`userId`, `organizationId`). App tables use snake_case.
- No tests exist yet. No test framework is set up.
