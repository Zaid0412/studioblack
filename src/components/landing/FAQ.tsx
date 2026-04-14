"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "What file types are supported?",
    answer:
      "StudioBlack supports PDFs, images (PNG, JPG, WebP), and architectural drawing formats. Files are organised by project phase with full version tracking.",
  },
  {
    question: "How does the client review process work?",
    answer:
      "Clients get their own secure portal with a magic link — no account required. They can view designs, leave feedback, and approve or request changes directly.",
  },
  {
    question: "Can I manage multiple projects at once?",
    answer:
      "Yes. Each project has its own phases, files, tasks, and review workflows. Your dashboard gives you an overview across all active projects.",
  },
  {
    question: "How many team members can I add?",
    answer:
      "You can invite project managers, architects, and clients to your organisation. Each role has tailored permissions so everyone sees only what they need.",
  },
  {
    question: "Is my data secure?",
    answer:
      "All data is stored on encrypted servers with Supabase. File uploads are scoped to your organisation with role-based access controls. Sessions are validated on every request.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "StudioBlack is free to get started. We'll introduce paid tiers for larger teams and advanced features as the platform grows.",
  },
];

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border-default">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left cursor-pointer"
      >
        <span className="text-sm font-medium text-text-primary pr-4">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-text-muted shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <p className="text-sm text-text-muted leading-relaxed pb-5">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 border-t border-border-default">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
            Frequently asked questions
          </h2>
          <p className="text-text-muted">
            Everything you need to know about StudioBlack.
          </p>
        </div>

        <div className="border-t border-border-default">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
