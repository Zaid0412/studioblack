/**
 * Tiny label + value cell used by both detail pages (studio + vendor portal).
 * Multiline mode spans both columns of the parent 2-col grid and preserves
 * newlines in the value.
 */
export function RfqDetailRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${multiline ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span
        className={`text-sm text-text-primary ${
          multiline ? "whitespace-pre-wrap" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
