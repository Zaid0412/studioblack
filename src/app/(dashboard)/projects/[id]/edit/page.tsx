"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { getProjectById } from "@/data/mock";

export default function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("editProject");
  const tc = useTranslations("common");
  const project = getProjectById(id);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">{tc("projectNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[800px]">
      <button
        onClick={() => router.push(`/projects/${id}`)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("backTo", { name: project.name })}
      </button>

      <PageHeader title={t("title")} subtitle={project.name} />

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            toast({
              title: t("updatedToast"),
              description: t("updatedDescription", { name: project.name }),
              variant: "success",
            });
            router.push(`/projects/${id}`);
          }}
          className="flex flex-col gap-5"
        >
          <Input
            label={t("projectName")}
            defaultValue={project.name}
          />
          <Input label={t("client")} defaultValue={project.client} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-text-secondary">
              {t("description")}
            </label>
            <textarea
              defaultValue={project.description}
              className="w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              rows={3}
            />
          </div>
          <Input
            label={t("deadline")}
            type="date"
            defaultValue={project.deadline}
          />

          <div className="flex items-center gap-3 mt-4">
            <Button type="submit">{t("saveChanges")}</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/projects/${id}`)}
            >
              {tc("cancel")}
            </Button>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="danger" className="ml-auto">
                  <Trash2 className="w-4 h-4" />
                  {t("deleteProject")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("deleteTitle", { name: project.name })}</DialogTitle>
                  <DialogDescription>
                    {t("deleteDescription")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">{tc("cancel")}</Button>
                  </DialogClose>
                  <Button
                    variant="danger"
                    onClick={() => {
                      setDeleteOpen(false);
                      toast({
                        title: t("deletedToast"),
                        description: t("deletedDescription", { name: project.name }),
                        variant: "error",
                      });
                      router.push("/projects");
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("deleteConfirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </form>
      </Card>
    </div>
  );
}
