/** Count how many of the 4 requirements the password meets. */
export function getStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return score;
}

/** Segmented bar color per strength level (0–4 met). */
export function barColor(strength: number): string {
  if (strength <= 1) return "bg-error";
  if (strength <= 2) return "bg-warning";
  return "bg-success";
}

/** Label text color per strength level. */
export function labelColor(strength: number): string {
  if (strength <= 1) return "text-error";
  if (strength <= 2) return "text-warning";
  return "text-success";
}
