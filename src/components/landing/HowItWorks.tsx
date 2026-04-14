const steps = [
  {
    number: "1",
    title: "Upload Your Designs",
    description:
      "Upload architectural drawings, PDFs, and images. Organise by project phase — from 2D layouts to floor plans.",
  },
  {
    number: "2",
    title: "Review & Collaborate",
    description:
      "Team members review designs, leave feedback, and track tasks. Clients get their own portal to approve or request changes.",
  },
  {
    number: "3",
    title: "Approve & Hand Over",
    description:
      "Once approved, designs are frozen and ready for production. The full audit trail is preserved for every project.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 md:py-32 border-t border-border-default"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            How it works
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            From upload to approval in three simple steps.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative flex flex-col items-center text-center"
            >
              {/* Connector line (between steps, desktop only) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-56px)] h-px bg-border-default" />
              )}

              {/* Number circle */}
              <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 border-accent bg-bg-primary text-accent font-bold text-lg mb-5">
                {step.number}
              </div>

              <h3 className="text-[15px] font-semibold text-text-primary mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-text-muted leading-relaxed max-w-xs">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
