import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";

export function Footer() {
  return (
    <footer className="border-t border-border-default py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo size="sm" />
              <span className="text-[15px] font-semibold text-text-primary">
                {branding.appName}
              </span>
            </div>
            <p className="text-xs text-text-muted max-w-xs">
              {branding.tagline}
            </p>
          </div>

          <div className="flex gap-16">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Product
              </span>
              <a
                href="#features"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                How It Works
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Account
              </span>
              <Link
                href="/login"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border-default">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} {branding.appName}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
