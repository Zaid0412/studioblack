"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { UploadDesignDialog } from "../_components/UploadDesignDialog";

/**
 * Dedicated design-upload route (e.g. the project menu's "Upload design"). Now a
 * thin shell over the shared `UploadDesignDialog` — closing or finishing returns
 * to the project. Per-file discipline/type + document numbering come from the
 * dialog (Document Control, PR-2).
 */
export default function DesignUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phaseId?: string; versionGroup?: string }>;
}) {
  const { id } = use(params);
  const { phaseId, versionGroup } = use(searchParams);
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const goToProject = () => {
    router.push(`/projects/${id}`);
    router.refresh();
  };

  return (
    <UploadDesignDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) goToProject();
      }}
      projectId={id}
      phaseId={phaseId ?? null}
      versionGroup={versionGroup ?? null}
      onSuccess={() => {
        trackEvent("attachment_uploaded", {
          project_id: id,
          phase_id: phaseId ?? null,
          is_new_version: !!versionGroup,
        });
        goToProject();
      }}
    />
  );
}
