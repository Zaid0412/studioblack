import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "For small firms getting started",
    features: [
      "Up to 3 projects",
      "2 team members",
      "Basic design reviews",
      "Client portal",
      "Email support",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/month",
    description: "For growing architecture firms",
    features: [
      "Unlimited projects",
      "10 team members",
      "Advanced review workflows",
      "Client portal with branding",
      "Task management",
      "Audit history",
      "Priority support",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large firms and studios",
    features: [
      "Everything in Professional",
      "Unlimited team members",
      "Custom integrations",
      "SSO & advanced security",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

/**
 *
 */
export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 border-t border-[#1A1A1A]">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-[family-name:var(--font-cabinet)]">
            Simple, transparent pricing
          </h2>
          <p className="text-[#A0A0A0] max-w-xl mx-auto">
            Start free and scale as your firm grows. No hidden fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-7 rounded-xl border ${
                plan.highlighted
                  ? "border-[#F5C518]/30 bg-[#F5C518]/[0.02]"
                  : "border-[#1A1A1A] bg-[#0D0D0D]"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#F5C518] text-[#0D0D0D] text-[10px] font-bold uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              <h3 className="text-[15px] font-semibold text-white mb-1">
                {plan.name}
              </h3>
              <p className="text-xs text-[#888888] mb-5">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-[#666666]">{plan.period}</span>
                )}
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-[#A0A0A0]"
                  >
                    <Check className="w-4 h-4 text-[#F5C518] shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`w-full py-2.5 text-sm font-medium text-center rounded-lg transition-colors ${
                  plan.highlighted
                    ? "bg-[#F5C518] text-[#0D0D0D] hover:bg-[#D4A90D]"
                    : "border border-[#333333] text-[#A0A0A0] hover:text-white hover:border-[#555555]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
