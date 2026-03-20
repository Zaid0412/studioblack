import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { branding } from "@/config/branding";

/**
 *
 */
export function Hero() {
  return (
    <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-[#F5C518]/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#F5C518]/20 bg-[#F5C518]/5 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F5C518]" />
          <span className="text-xs font-medium text-[#F5C518]">
            Architectural Design Review Platform
          </span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6 font-[family-name:var(--font-cabinet)]">
          {branding.tagline.split(",")[0]},
          <br />
          <span className="text-[#F5C518]">
            {branding.tagline.split(",")[1]?.trim()}
          </span>
        </h1>

        <p className="text-lg md:text-xl text-[#A0A0A0] max-w-2xl mx-auto mb-10 leading-relaxed">
          {branding.subtitle}. Streamline your workflow from design upload to
          client approval — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg bg-[#F5C518] text-[#0D0D0D] hover:bg-[#D4A90D] transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-lg border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#555555] transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}
