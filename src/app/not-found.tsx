import Link from "next/link";
import { branding } from "@/config/branding";

/**
 *
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0D0D] px-4 text-center">
      <img
        src={branding.logoUrl}
        alt={branding.appName}
        className="mb-8 h-10 w-auto"
      />

      <h1 className="text-[120px] font-extrabold leading-none tracking-tight text-[#F5C518]">
        404
      </h1>

      <p className="mt-2 text-lg font-medium text-white">Page not found</p>

      <p className="mt-2 max-w-md text-sm text-[#888888]">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#F5C518] px-6 py-2.5 text-sm font-semibold text-[#0D0D0D] transition-colors hover:bg-[#F5C518]/90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
