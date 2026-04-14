"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { branding } from "@/config/branding";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#faq", label: "FAQ" },
];

/** Animated hamburger / X icon. */
function MenuIcon({ open }: { open: boolean }) {
  const bar =
    "block absolute left-1/2 -translate-x-1/2 h-[2px] w-5 bg-text-primary rounded-full transition-all duration-300";
  return (
    <div className="relative w-5 h-5">
      <span
        className={cn(bar, open ? "top-[9px] rotate-45" : "top-[3px] rotate-0")}
      />
      <span
        className={cn(bar, "top-[9px]", open ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100")}
      />
      <span
        className={cn(bar, open ? "top-[9px] -rotate-45" : "top-[15px] rotate-0")}
      />
    </div>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-lg">
      <div className="relative flex h-16 items-center px-6">
        {/* Logo — left edge */}
        <Link href="/" className="flex items-center">
          <BrandLogo size="md" />
        </Link>

        {/* Center links — absolute center */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Right side — right edge */}
        <div className="flex items-center gap-3 ml-auto">
          <ThemeToggle className="relative" />
          <Link
            href="/login"
            className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-text-primary bg-accent hover:bg-accent-hover rounded-lg transition-colors"
          >
            Go to Platform
          </Link>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {/* Mobile menu — slide down / up */}
      <div
        className={cn(
          "md:hidden grid transition-[grid-template-rows] duration-300 ease-in-out",
          mobileOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border-default bg-bg-primary px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-text-primary bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              Go to Platform
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
