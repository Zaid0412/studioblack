# Lazy-load the task side panel (drop react-markdown from the shared chunk)

- **Tier / Impact / Effort:** T1 · High · S
- **Area:** bundle
- **Files:** `src/components/tasks/TaskSidePanelHost.tsx:7,44-56`, `src/app/(dashboard)/layout.tsx:17,126-128`

## Problem
`src/app/(dashboard)/layout.tsx:127` mounts `<TaskSidePanelHost>` on **every** dashboard route. The host statically imports `TaskSidePanel` (`TaskSidePanelHost.tsx:7`), which pulls in `TaskComposer` → `TaskMarkdownEditor`; both `TaskSidePanel` and `TaskMarkdownEditor` import `react-markdown` + `remark-gfm` (~60-100KB gzipped combined). Because the import is static and the host is in the shared dashboard layout, react-markdown lands in the **common dashboard chunk** loaded on first paint of any dashboard page.

But the panel only renders when the URL has `?task=<id>`: `TaskSidePanelHost.tsx:46` returns `null` when `taskId` is absent. So the markdown stack ships to every user on every route while rendering nothing until a task is actually opened.

## Fix
1. In `src/components/tasks/TaskSidePanelHost.tsx`, replace the static import with a `next/dynamic` client-only import so the panel's code (and its react-markdown dependency) only downloads when a task opens:

```ts
import dynamic from "next/dynamic";
// remove: import { TaskSidePanel } from "./TaskSidePanel";

const TaskSidePanel = dynamic(
  () => import("./TaskSidePanel").then((m) => ({ default: m.TaskSidePanel })),
  { ssr: false }
);
```

2. No guard change needed — the host already returns `null` while `!taskId` (line 46), so the dynamic chunk isn't requested until the user navigates to `?task=<id>`. The existing `<Suspense fallback={null}>` wrapper in `layout.tsx:126-128` covers the dynamic boundary.

3. `TaskSidePanel` is exported as a named export, hence the `.then((m) => ({ default: m.TaskSidePanel }))` interop.

## Verification
- Run the bundle analyzer (`ANALYZE=true npm run build` if configured, or inspect `.next` chunk output) and confirm `react-markdown` / `remark-gfm` no longer appear in the shared dashboard chunk — they move into a lazily-loaded `TaskSidePanel` chunk.
- Manual: open any dashboard route, confirm no task-panel JS in the network tab on load; append `?task=<valid-id>`, confirm the panel loads and renders markdown correctly (description, comments).
- `npm run check` green.

## Risks / notes
- `ssr: false` is correct here — the panel is an interactive overlay driven by `useSearchParams` and never needs server HTML.
- First open of a task now incurs a one-time chunk fetch (brief spinner via the panel's own loading state / SWR). Acceptable tradeoff vs. shipping it to every page.
- If any other route deep-links a task on first load, the chunk fetches then too — still strictly better than the current always-load.
