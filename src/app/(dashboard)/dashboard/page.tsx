"use client";

import { useUserRole } from "@/hooks/useUserRole";
import { DashboardSkeleton } from "./_components/DashboardSkeleton";
import { PmDashboard } from "./_components/PmDashboard";
import { ClientDashboard } from "./_components/ClientDashboard";
import { VendorDashboard } from "./_components/VendorDashboard";

/** Role-routed dashboard: vendor, client, or PM/architect. */
export default function DashboardPage() {
  const { role, loading } = useUserRole();

  if (loading || !role) return <DashboardSkeleton />;
  if (role === "vendor") return <VendorDashboard />;
  if (role === "client") return <ClientDashboard />;
  return <PmDashboard />;
}
