import { Upload, MessageSquareText, CheckCircle2 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Designs",
    description:
      "Upload architectural drawings, plans, and documents to your project workspace.",
  },
  {
    number: "02",
    icon: MessageSquareText,
    title: "Review & Collaborate",
    description:
      "Team members and clients review designs, leave comments, and request changes.",
  },
  {
    number: "03",
    icon: CheckCircle2,
    title: "Approve & Deliver",
    description:
      "Get formal sign-off from architects and clients. Track every approval in the audit trail.",
  },
];

/**
 *
 */
export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 md:py-32 border-t border-[#1A1A1A]"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 font-[family-name:var(--font-cabinet)]">
            How it works
          </h2>
          <p className="text-[#A0A0A0] max-w-xl mx-auto">
            From upload to approval in three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, idx) => (
            <div key={step.number} className="relative text-center">
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#333333] to-transparent" />
              )}

              <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl border border-[#1A1A1A] bg-[#111111] mb-5">
                <step.icon className="w-6 h-6 text-[#F5C518]" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#F5C518] text-[#0D0D0D] text-[10px] font-bold flex items-center justify-center">
                  {step.number}
                </span>
              </div>

              <h3 className="text-[15px] font-semibold text-white mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-[#888888] leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
