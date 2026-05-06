"use client";

import { useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { API } from "@/lib/api/routes";
import { TaskSidePanel } from "./TaskSidePanel";
import type { Task } from "@/types";

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

  const close = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("task");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Esc closes — only mounted while the panel is open.
  useEffect(() => {
    if (!taskId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [taskId, close]);

  const { data: task, error } = useSWR<Task>(taskId ? API.task(taskId) : null);

  if (!taskId) return null;

  return (
    <TaskSidePanel
      taskId={taskId}
      task={task ?? null}
      missing={Boolean(error)}
      onClose={close}
    />
  );
}
