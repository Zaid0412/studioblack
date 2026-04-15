/** Horizontal rule with centered label text. */
export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-px bg-border-default" />
      <span className="text-xs text-text-muted">{label}</span>
      <div className="flex-1 h-px bg-border-default" />
    </div>
  );
}
