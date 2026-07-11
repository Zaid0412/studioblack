import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared error state for the role dashboards. */
export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle className="w-6 h-6 text-red-400" />
      <p className="text-sm text-text-muted">
        Something went wrong loading your dashboard.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
