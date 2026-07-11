import { NavTransition } from "@/components/NavTransition";

/** Replays a subtle fade-in on every top-level dashboard navigation. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <NavTransition>{children}</NavTransition>;
}
