import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { features } from "@/config/features";

/** Landing page — public marketing page at /. */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      {features.landingPricing && <Pricing />}
      {features.landingTestimonials && <Testimonials />}
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
