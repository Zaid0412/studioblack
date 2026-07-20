/** Compact, icon-less "nothing here yet" hint for an empty card panel. */
export function EmptyHint({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <p className="text-xs text-text-muted">{hint}</p>
    </div>
  );
}
