import { Sidebar } from "@/components/layout/sidebar";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar variant="client" />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
