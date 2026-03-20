import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";

/**
 *
 */
export function Footer() {
  return (
    <footer className="border-t border-[#1A1A1A] py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <BrandLogo size="sm" />
              <span className="text-[15px] font-semibold text-white">
                {branding.appName}
              </span>
            </div>
            <p className="text-xs text-[#666666] max-w-xs">
              {branding.subtitle}
            </p>
          </div>

          <div className="flex gap-16">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">
                Product
              </span>
              <a
                href="#features"
                className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
              >
                How it Works
              </a>
              <a
                href="#pricing"
                className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
              >
                Pricing
              </a>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-1">
                Account
              </span>
              <Link
                href="/login"
                className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[#444444]">
            &copy; {new Date().getFullYear()} {branding.appName}. All rights
            reserved.
          </span>
          <a
            href={`mailto:${branding.supportEmail}`}
            className="text-xs text-[#444444] hover:text-[#A0A0A0] transition-colors"
          >
            {branding.supportEmail}
          </a>
        </div>
      </div>
    </footer>
  );
}
