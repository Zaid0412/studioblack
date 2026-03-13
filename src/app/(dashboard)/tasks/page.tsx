"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Loader2,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigned_to: string;
  requires_client_review: boolean;
  review_status: string | null;
  due_date: string | null;
  created_at: string;
  phase_name: string;
  phase_order: number;
  project_name: string;
  project_id: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-warning" />;
    default:
      return <AlertCircle className="w-4 h-4 text-text-muted" />;
  }
};

const reviewBadge = (review_status: string | null) => {
  if (!review_status) return null;
  switch (review_status) {
    case "pending_review":
      return <Badge variant="submitted">Pending Review</Badge>;
    case "approved":
      return <Badge variant="approved-client">Approved</Badge>;
    case "changes_requested":
      return <Badge variant="changes-requested">Changes Requested</Badge>;
    default:
      return null;
  }
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/tasks")
      .then((res) => (res.ok ? res.json() : []))
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
      </div>
    );
  }

  // Group by project
  const grouped = new Map<string, { projectName: string; projectId: string; tasks: Task[] }>();
  for (const task of tasks) {
    if (!grouped.has(task.project_id)) {
      grouped.set(task.project_id, {
        projectName: task.project_name,
        projectId: task.project_id,
        tasks: [],
      });
    }
    grouped.get(task.project_id)!.tasks.push(task);
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1000px]">
      <PageHeader
        title="My Tasks"
        subtitle="Tasks assigned to you across all projects"
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks assigned"
          description="You don't have any tasks assigned to you yet."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(grouped.values()).map(({ projectName, projectId, tasks: projectTasks }) => (
            <div key={projectId} className="flex flex-col gap-3">
              <button
                onClick={() => router.push(`/projects/${projectId}`)}
                className="text-sm font-semibold text-accent hover:underline self-start"
              >
                {projectName}
              </button>
              <div className="flex flex-col gap-2">
                {projectTasks.map((task) => (
                  <Card key={task.id} className="!p-4">
                    <div className="flex items-center gap-3">
                      {statusIcon(task.status)}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-text-primary">
                          {task.title}
                        </span>
                        <span className="text-xs text-text-muted">
                          Phase {task.phase_order}: {task.phase_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {reviewBadge(task.review_status)}
                        {task.requires_client_review && task.review_status === "pending_review" && (
                          <Eye className="w-3.5 h-3.5 text-warning" />
                        )}
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-text-muted">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.due_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full capitalize">
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
