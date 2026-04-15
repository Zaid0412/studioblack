const testimonials = [
  {
    quote:
      "StudioBlack transformed how we handle design approvals. What used to take weeks of back-and-forth emails now happens in days.",
    name: "Sarah Chen",
    role: "Principal Architect",
    company: "Chen & Associates",
  },
  {
    quote:
      "The client portal is a game-changer. Our clients can review and approve designs without us scheduling a meeting every time.",
    name: "James Morrison",
    role: "Studio Director",
    company: "Morrison Design Group",
  },
  {
    quote:
      "Finally, a review platform that understands how architecture firms actually work. Clean, simple, and effective.",
    name: "Aisha Patel",
    role: "Senior Project Manager",
    company: "Urban Edge Studio",
  },
];

export function Testimonials() {
  return (
    <section className="py-24 md:py-32 border-t border-border-default">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Trusted by architecture firms
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            See what teams are saying about StudioBlack.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="flex flex-col p-7 rounded-xl border border-border-default bg-bg-secondary"
            >
              <p className="text-sm text-text-secondary leading-relaxed flex-1 mb-6">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {t.name}
                </p>
                <p className="text-xs text-text-muted">
                  {t.role}, {t.company}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
