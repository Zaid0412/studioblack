"use client";

/**
 * Project Overview — the project home (`/projects/[id]`).
 *
 * Placeholder while the dashboard (KPIs, charts, details, activity, team) is
 * built out in this PR. Renders inside the shared project chrome (header + tab
 * strip) like every other tab page.
 */
export function OverviewTab({ projectId }: { projectId: string }) {
  return (
    <div className="px-4 lg:px-10 py-8">
      <p className="text-text-muted text-sm">
        Overview dashboard — coming in this PR (project {projectId}).
      </p>
    </div>
  );
}
