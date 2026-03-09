"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

export default function CreateProjectPage() {
  const router = useRouter();
  const t = useTranslations("createProject");
  const tc = useTranslations("common");
  const [sections, setSections] = useState<string[]>([
    t("defaultSectionFloorPlans"),
    t("defaultSectionElevations"),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <button
        onClick={() => router.push("/projects")}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {tc("backToProjects")}
      </button>

      <PageHeader title={t("title")} />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast({
              title: t("createdToast"),
              description: t("createdDescription"),
              variant: "success",
            });
            router.push("/projects");
          }}
          className="flex flex-col gap-5"
        >
          <h3 className="text-base font-semibold text-text-primary">
            {t("projectDetails")}
          </h3>

          <Input
            label={t("projectName")}
            placeholder={t("projectNamePlaceholder")}
          />
          <Input label={t("client")} placeholder={t("clientPlaceholder")} />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("description")}
            </label>
            <textarea
              placeholder={t("descriptionPlaceholder")}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              rows={3}
            />
          </div>

          <DatePicker
            label={t("deadline")}
            placeholder={t("deadlinePlaceholder")}
          />

          {/* Design Sections */}
          <div className="flex flex-col gap-3 mt-2">
            <h3 className="text-base font-semibold text-text-primary">
              {t("designSections")}
            </h3>
            {sections.map((section, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={section}
                  onChange={(e) => {
                    const updated = [...sections];
                    updated[i] = e.target.value;
                    setSections(updated);
                  }}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSections(sections.filter((_, idx) => idx !== i))
                  }
                  className="p-2 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setSections([...sections, ""])}
            >
              <Plus className="w-4 h-4" />
              {t("addSection")}
            </Button>
          </div>

          <div className="flex gap-3 mt-4">
            <Button type="submit">{t("createButton")}</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/projects")}
            >
              {tc("cancel")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
