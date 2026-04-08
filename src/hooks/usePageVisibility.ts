import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

function getSnapshot() {
  return !document.hidden;
}

function getServerSnapshot() {
  return true;
}

/** Returns `true` when the tab is visible, `false` when hidden. */
export function usePageVisibility() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
