"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBoq } from "@/hooks/useBoq";
import { BoqCreateDialog } from "../boq/_components/BoqCreateDialog";

interface BoqTabProps {
  projectId: string;
  projectName: string;
}

/**
 * BOQ tab content on the project detail page.
 *
 * Task 5A — infrastructure only: shows empty-state CTA when no BOQ exists,
 * a loading skeleton while fetching, and a raw JSON dump once a BOQ is loaded.
 * Task 5B will replace the JSON dump with the actual summary cards + table.
 */
export function BoqTab({ projectId, projectName }: BoqTabProps) {
  const { boq, notFound, isLoading, error } = useBoq(projectId);
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="px-4 lg:px-10 py-6 flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 lg:px-10 py-6">
        <p className="text-sm text-error">
          Failed to load BOQ. Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (notFound) {
    return (
      <>
        <EmptyState
          icon={FileSpreadsheet}
          title="No BOQ yet"
          description="Create a Bill of Quantities for this project to start tracking costs, margins, and client approvals."
          action={{
            label: "Create BOQ",
            onClick: () => setCreateOpen(true),
          }}
        />
        <BoqCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          defaultTitle={projectName}
        />
      </>
    );
  }

  if (!boq) return null;

  // Placeholder for 5A — 5B replaces this with summary cards + table.
  return (
    <div className="px-4 lg:px-10 py-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-text-primary">
            {boq.title}
          </h2>
          <p className="text-xs text-text-muted">
            v{boq.version} · {boq.status} · {boq.currency} · {boq.items.length}{" "}
            item{boq.items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <pre className="text-[11px] text-text-muted bg-bg-elevated rounded-lg p-4 overflow-auto max-h-[60vh]">
        {JSON.stringify(boq, null, 2)}
      </pre>
    </div>
  );
}
