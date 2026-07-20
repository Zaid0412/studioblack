"use client";

import { useTranslations } from "next-intl";
import { formatDate } from "@/lib/formatDate";
import { Badge, statusToBadgeVariant } from "@/components/ui/badge";
import type { DbProjectDetail, ProjectStatus } from "@/types";
import { OverviewCard } from "./OverviewCard";

interface ProjectDetailsCardProps {
  project: DbProjectDetail;
  variant: "pm" | "client";
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-[0.5px] text-text-muted">
        {label}
      </span>
      <span className="break-words text-[14px] font-medium text-text-primary">
        {value}
      </span>
    </div>
  );
}

/**
 * Project metadata card on the Overview — the fields that used to live in the
 * `MetaBar`. PM sees client/team/created/location/scope/area/estimate; the
 * client variant sees status/category/deadline only (no internal cost fields).
 */
export function ProjectDetailsCard({
  project,
  variant,
}: ProjectDetailsCardProps) {
  const t = useTranslations("projectDetail");
  const to = useTranslations("projectOverview");

  if (variant === "client") {
    return (
      <OverviewCard
        title={to("projectDetails")}
        bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4"
      >
        {project.status && (
          <Detail
            label={t("statusLabel")}
            value={
              <Badge
                variant={statusToBadgeVariant(project.status as ProjectStatus)}
              >
                {project.status.charAt(0).toUpperCase() +
                  project.status.slice(1)}
              </Badge>
            }
          />
        )}
        {project.category && (
          <Detail
            label={t("category")}
            value={<span className="capitalize">{project.category}</span>}
          />
        )}
        {project.deadline && (
          <Detail label={t("duePrefix")} value={formatDate(project.deadline)} />
        )}
      </OverviewCard>
    );
  }

  const client = project.client_name || project.client_email || "—";
  const pms =
    project.members
      .filter((m) => m.role === "pm")
      .map((m) => m.name)
      .join(", ") || "—";
  const architects =
    project.members
      .filter((m) => m.role === "architect")
      .map((m) => m.name)
      .join(", ") || "—";
  const location =
    [project.address, project.city, project.state].filter(Boolean).join(", ") ||
    null;

  return (
    <OverviewCard
      title={to("projectDetails")}
      bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4"
    >
      <Detail label={t("clientLabel")} value={client} />
      <Detail label={t("pms")} value={pms} />
      <Detail label={t("architects")} value={architects} />
      <Detail label={t("created")} value={formatDate(project.created_at)} />
      {location && <Detail label={t("location")} value={location} />}
      {project.scope && (
        <div className="hidden lg:block">
          <Detail label={t("scope")} value={project.scope} />
        </div>
      )}
      {project.area_sqft != null && (
        <Detail
          label={t("areaSqft")}
          value={project.area_sqft.toLocaleString()}
        />
      )}
      {project.estimation_inr != null && (
        <Detail
          label={t("estimationInr")}
          value={project.estimation_inr.toLocaleString("en-IN")}
        />
      )}
    </OverviewCard>
  );
}
