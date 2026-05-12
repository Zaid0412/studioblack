"use client";

import { use } from "react";
import { BoqSubTabStrip } from "./_components/BoqSubTabStrip";

/**
 * BOQ container layout — sub-tab strip + active sub-tab content. The
 * project workflow stepper lives in the parent project layout so it
 * stays mounted when switching between Design and BOQ.
 */
export default function BoqLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);

  return (
    <>
      <BoqSubTabStrip projectId={id} />
      {children}
    </>
  );
}
