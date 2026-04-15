import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "For small studios getting started",
    price: "Free",
    period: null,
    cta: "Get Started",
    highlighted: false,
    features: [
      "Up to 3 projects",
      "2 team members",
      "Basic file management",
      "Email support",
    ],
  },
  {
    name: "Professional",
    description: "For growing architecture firms",
    price: "$29",
    period: "/month",
    cta: "Start Free Trial",
    highlighted: true,
    features: [
      "Unlimited projects",
      "10 team members",
      "Client portal",
      "Task management",
      "Version tracking",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    description: "For large firms with custom needs",
    price: "Custom",
    period: null,
    cta: "Contact Sales",
    highlighted: false,
    features: [
      "Everything in Professional",
      "Unlimited team members",
      "Custom branding",
      "SSO & advanced security",
      "Dedicated account manager",
      "SLA guarantee",
    ],
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="py-24 md:py-32 border-t border-border-default"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            Start free. Upgrade when you need more.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col p-7 rounded-xl border transition-colors ${
                plan.highlighted
                  ? "border-accent/40 bg-accent/5"
                  : "border-border-default bg-bg-secondary"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent text-xs font-semibold text-text-primary tracking-wider">
                  Most Popular
                </div>
              )}

              <h3 className="text-[15px] font-semibold text-text-primary mb-1">
                {plan.name}
              </h3>
              <p className="text-xs text-text-muted mb-5">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-text-primary">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-text-muted">{plan.period}</span>
                )}
              </div>

              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-text-secondary"
                  >
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`w-full py-2.5 text-sm font-medium text-center rounded-lg transition-colors block ${
                  plan.highlighted
                    ? "bg-accent text-text-primary hover:bg-accent-hover"
                    : "border border-border-default text-text-secondary hover:text-text-primary hover:border-text-muted/50"
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
