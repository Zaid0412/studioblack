"use client";

import dynamic from "next/dynamic";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { API } from "@/lib/api/routes";
import type { Task } from "@/types";

// Deferred: this host mounts on every dashboard route but only renders when
// `?task=<id>` is present. Loading TaskSidePanel eagerly would pull its
// react-markdown + remark-gfm chain (~60-100 KB gz) into the shared dashboard
// chunk. `next/dynamic` (client-only) defers it to when a task actually opens.
const TaskSidePanel = dynamic(
  () => import("./TaskSidePanel").then((m) => m.TaskSidePanel),
  { ssr: false }
);

/**
 * Global overlay host. Listens for `?task=<id>` on any dashboard route and
 * renders the universal `TaskSidePanel` over the page when present.
 *
 * Closing the panel (Esc, scrim click, or the close button) drops the
 * `task` query param and leaves the rest of the URL untouched.
 *
 * Mounted once in `app/(dashboard)/layout.tsx` so any task row anywhere in
 * the app can open the panel by pushing `?task=<id>`. There is no docked
 * variant — this is the single source for the side panel.
 */
export function TaskSidePanelHost() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const taskId = searchParams.get("task");

  const close = () => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("task");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const { data: task, error } = useSWR<Task>(taskId ? API.task(taskId) : null);

  // Mount only while a task is open (keeps the deferred react-markdown chunk
  // off other routes). The Sheet handles Esc/scrim-close + the slide-in
  // animation itself, so no manual keydown listener is needed.
  if (!taskId) return null;

  return (
    <TaskSidePanel
      open={Boolean(taskId)}
      taskId={taskId}
      task={task ?? null}
      missing={Boolean(error)}
      onClose={close}
    />
  );
}
