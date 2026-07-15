"use client";

import { Suspense, use, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SlidersHorizontal,
  ListOrdered,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNavLink } from "@/components/settings/SettingsNavLink";
import { useUserRoleContext } from "@/contexts/UserRoleContext";
import { ProjectDetailsSection } from "./_components/ProjectDetailsSection";
import { ProjectBoqSettingsSection } from "./_components/ProjectBoqSettingsSection";

type SectionId = "details" | "boq";

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

  type NavEntry = { id: SectionId; label: string; icon: LucideIcon };
  const navItems: NavEntry[] = [
    { id: "details", label: t("nav.details"), icon: SlidersHorizontal },
    { id: "boq", label: t("nav.boq"), icon: ListOrdered },
  ];

  const requested = searchParams.get("section") as SectionId | null;
  const active: SectionId =
    navItems.find((s) => s.id === requested)?.id ?? "details";

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
            />
          ))}
        </nav>

        <div
          key={active}
          className="min-w-0 max-w-[800px] animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none"
        >
          {active === "details" ? (
            <ProjectDetailsSection projectId={projectId} />
          ) : (
            <ProjectBoqSettingsSection projectId={projectId} />
          )}
        </div>
      </div>
    </div>
  );
}
