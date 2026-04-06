import Image from "next/image";
import Link from "next/link";
import { branding } from "@/config/branding";

/** 404 page shown when no route matches. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4 text-center">
      {/* Light mode logo (default) — hidden when dark */}
      <Image
        src={branding.logoUrlDark ?? branding.logoUrl}
        alt={branding.appName}
        width={160}
        height={160}
        className="mb-1 h-40 w-40 object-contain [[data-theme=dark]_&]:hidden"
      />
      {/* Dark mode logo — hidden by default, shown when dark */}
      <Image
        src={branding.logoUrl}
        alt={branding.appName}
        width={160}
        height={160}
        className="mb-1 h-40 w-40 object-contain hidden [[data-theme=dark]_&]:block"
      />

      <h1 className="text-[120px] font-extrabold leading-none tracking-tight text-accent">
        404
      </h1>

      <p className="mt-2 text-lg font-medium text-text-primary">
        Page not found
      </p>

      <p className="mt-2 max-w-md text-sm text-text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
