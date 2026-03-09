"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Calendar,
  Eye,
  Edit,
  Upload,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { projects } from "@/data/mock";
import type { ProjectStatus } from "@/types";

type FilterTab = "all" | ProjectStatus;

/** Projects list with status filter tabs and search. */
export default function ProjectsPage() {
  const t = useTranslations("projects");
  const te = useTranslations("emptyStates");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const filters: { key: FilterTab; label: string }[] = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterActive") },
    { key: "completed", label: t("filterCompleted") },
    { key: "draft", label: t("filterDraft") },
  ];

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "all" || p.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col gap-6 max-w-[1200px]">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button onClick={() => router.push("/projects/new")}>
            {t("newProject")}
          </Button>
        }
      />

      {/* Search + Filters */}
      <div className="flex items-center gap-4">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          containerClassName="w-80"
        />
        <Tabs
          value={activeFilter}
          onValueChange={(v) => setActiveFilter(v as FilterTab)}
          className="ml-auto"
        >
          <TabsList>
            {filters.map((f) => (
              <TabsTrigger key={f.key} value={f.key}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("projectName")}
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("client")}
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("status")}
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("deadline")}
              </th>
              <th className="text-left text-xs font-medium text-text-muted px-5 py-3">
                {t("team")}
              </th>
              <th className="text-right text-xs font-medium text-text-muted px-5 py-3">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => (
              <tr
                key={project.id}
                className="border-b border-border-default last:border-b-0 hover:bg-bg-elevated/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <td className="px-5 py-4">
                  <span className="text-sm font-semibold text-text-primary">
                    {project.name}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-sm text-text-secondary">
                    {project.client}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Badge variant={statusToBadgeVariant(project.status)}>
                    {project.status.charAt(0).toUpperCase() +
                      project.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                    <Calendar className="w-3.5 h-3.5 text-warning" />
                    {new Date(project.deadline).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex -space-x-2">
                    {project.team.slice(0, 3).map((member) => (
                      <Avatar
                        key={member.id}
                        initials={member.initials}
                        size="sm"
                        className="ring-2 ring-bg-secondary"
                      />
                    ))}
                    {project.team.length > 3 && (
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-bg-elevated text-xs text-text-muted ring-2 ring-bg-secondary">
                        +{project.team.length - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        {t("viewProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}/edit`);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        {t("editProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/projects/${project.id}/upload`);
                        }}
                      >
                        <Upload className="w-4 h-4" />
                        {t("uploadDesign")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t("deleteProject")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={FolderOpen}
                    title={te("projectsTitle")}
                    description={te("projectsDescription")}
                    action={{
                      label: te("projectsAction"),
                      href: "/projects/new",
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
