import { ClipboardCheck, Users, Upload, ListChecks } from "lucide-react";

const items = [
  {
    icon: ClipboardCheck,
    title: "Design Reviews",
    description:
      "Submit designs for structured review with approval workflows. Track status from draft to client sign-off.",
  },
  {
    icon: Users,
    title: "Client Portal",
    description:
      "Give clients their own secure portal to review designs, leave feedback, and approve submissions.",
  },
  {
    icon: Upload,
    title: "File Management",
    description:
      "Upload architectural drawings, PDFs, and images. Organize files by project with version tracking.",
  },
  {
    icon: ListChecks,
    title: "Task Management",
    description:
      "Create tasks with checklists, assign team members, attach files, and track progress across projects.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Everything you need to manage design reviews
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            A complete platform built for architectural firms to streamline the
            review and approval process.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {items.map((item) => (
            <div
              key={item.title}
              className="group relative p-7 rounded-xl border border-border-default bg-bg-secondary hover:border-text-muted/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-text-primary mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-sm text-text-muted leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
