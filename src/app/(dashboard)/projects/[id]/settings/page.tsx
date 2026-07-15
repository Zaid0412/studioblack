"use client";

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  ListOrdered,
  Users,
  Workflow,
  TriangleAlert,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { SettingsNavLink } from "@/components/settings/SettingsNavLink";
import { useUserRoleContext } from "@/contexts/UserRoleContext";
import { ProjectDetailsSection } from "./_components/ProjectDetailsSection";
import { ProjectBoqSettingsSection } from "./_components/ProjectBoqSettingsSection";
import { TeamAccessSection } from "./_components/TeamAccessSection";
import { ProjectWorkflowSection } from "./_components/ProjectWorkflowSection";
import { ProjectDangerSection } from "./_components/ProjectDangerSection";

type SectionId = "details" | "team" | "boq" | "workflow" | "danger";

/** Per-project settings — vertical nav, section chosen via `?section=`. */
export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <ProjectSettingsInner projectId={id} />
    </Suspense>
  );
}

function ProjectSettingsInner({ projectId }: { projectId: string }) {
  const t = useTranslations("projectSettings");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Project-scoped role from the layout's UserRoleProvider — only project PMs
  // may reach settings (the PATCH/DELETE routes 403 anyone else as a backstop).
  const role = useUserRoleContext()?.role;
  useEffect(() => {
    if (role && role !== "pm") router.replace(`/projects/${projectId}`);
  }, [role, projectId, router]);

  type NavEntry = {
    id: SectionId;
    label: string;
    icon: LucideIcon;
    danger?: boolean;
  };
  const navItems: NavEntry[] = [
    { id: "details", label: t("nav.details"), icon: SlidersHorizontal },
    { id: "team", label: t("nav.team"), icon: Users },
    { id: "boq", label: t("nav.boq"), icon: ListOrdered },
    { id: "workflow", label: t("nav.workflow"), icon: Workflow },
    { id: "danger", label: t("nav.danger"), icon: TriangleAlert, danger: true },
  ];

  const requested = searchParams.get("section") as SectionId | null;
  const active: SectionId =
    navItems.find((s) => s.id === requested)?.id ?? "details";

  // Until the project-scoped role resolves to PM, show a skeleton rather than
  // flashing the sections (a non-PM is redirected by the effect above).
  if (role !== "pm") {
    return (
      <div className="flex flex-col gap-6 max-w-[800px]">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 ease-out motion-reduce:animate-none flex flex-col gap-6">
      <Link
        href={`/projects/${projectId}`}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("backToProject")}
      </Link>

      <PageHeader title={t("title")} />

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <nav className="flex flex-col gap-1">
          {navItems.map((s) => (
            <SettingsNavLink
              key={s.id}
              href={`/projects/${projectId}/settings?section=${s.id}`}
              icon={s.icon}
              label={s.label}
              isActive={s.id === active}
              danger={s.danger}
            />
          ))}
        </nav>

        <div
          key={active}
          className="min-w-0 max-w-[800px] animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
        >
          {active === "details" && (
            <ProjectDetailsSection projectId={projectId} />
          )}
          {active === "team" && <TeamAccessSection projectId={projectId} />}
          {active === "boq" && (
            <ProjectBoqSettingsSection projectId={projectId} />
          )}
          {active === "workflow" && (
            <ProjectWorkflowSection projectId={projectId} />
          )}
          {active === "danger" && (
            <ProjectDangerSection projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
