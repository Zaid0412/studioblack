/** Fade + slide-from-left wrapper, replayed on navigation via `template.tsx`. */
export function NavTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 duration-200 ease-out motion-reduce:animate-none">
      {children}
    </div>
  );
}
