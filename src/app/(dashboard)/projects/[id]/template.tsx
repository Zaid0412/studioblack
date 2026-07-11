import { NavTransition } from "@/components/NavTransition";

/** Fades the project tab body in on tab/param change, leaving chrome persistent. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <NavTransition>{children}</NavTransition>;
}
