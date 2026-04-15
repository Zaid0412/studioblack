import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 md:py-32 border-t border-border-default">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
          Ready to streamline your design reviews?
        </h2>
        <p className="text-text-muted max-w-lg mx-auto mb-10">
          Join architecture firms that have simplified their review and approval
          process. Get started in minutes — no credit card required.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-accent hover:bg-accent-hover text-text-primary rounded-lg transition-colors"
        >
          Get Started Free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
