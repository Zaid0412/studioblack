"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { branding } from "@/config/branding";
import { features } from "@/config/features";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
  ...(features.landingPricing ? [{ href: "#pricing", label: "Pricing" }] : []),
];

/**
 *
 */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0D0D0D]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between h-16 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo size="sm" />
          <span className="text-[15px] font-semibold text-white">
            {branding.appName}
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[#A0A0A0] hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#F5C518] text-[#0D0D0D] hover:bg-[#D4A90D] transition-colors"
          >
            Go to Platform
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-[#A0A0A0] hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-200 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/5",
          mobileOpen ? "max-h-60" : "max-h-0 border-t-0"
        )}
      >
        <div className="flex flex-col gap-1 px-6 py-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[#A0A0A0] hover:text-white py-2 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/login"
            className="mt-2 px-4 py-2.5 text-sm font-medium text-center rounded-lg bg-[#F5C518] text-[#0D0D0D] hover:bg-[#D4A90D] transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            Go to Platform
          </Link>
        </div>
      </div>
    </nav>
  );
}
