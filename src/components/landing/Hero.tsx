import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { branding } from "@/config/branding";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border-default bg-bg-secondary text-xs font-medium text-text-muted mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Built for architecture firms
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold text-text-primary leading-tight mb-6 max-w-3xl mx-auto">
          Design Reviews, <span className="text-accent">Simplified</span>
        </h1>

        <p className="text-base md:text-lg text-text-muted max-w-xl mx-auto mb-10">
          {branding.tagline}. Streamline architectural design reviews, client
          approvals, and project handover — all in one platform.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold bg-accent hover:bg-accent-hover text-text-primary rounded-lg transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium border border-border-default text-text-secondary hover:text-text-primary hover:border-text-muted rounded-lg transition-colors"
          >
            Learn More
          </a>
        </div>

        {/* Trust line */}
        <p className="text-xs text-text-muted mt-12">
          Free to start · No credit card required
        </p>
      </div>
    </section>
  );
}
