"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { UserRole } from "@/types";

/** Inline form shown at the top of the sidebar for a new comment. */
export function NewPinForm({
  pendingPin,
  members,
  defaultAssignee,
  role,
  requestChangesMode,
  onSubmit,
  onCancel,
  onClearPin,
  onRequestPin,
}: {
  pendingPin: { xPercent: number; yPercent: number; page: number } | null;
  members: { user_id: string; name: string }[];
  /** Default assignee (pre-selected in the dropdown). */
  defaultAssignee?: string;
  /** Current user role — used to gate comment form options. */
  role?: UserRole | null;
  /** When true, pre-check and lock "Request changes". */
  requestChangesMode?: boolean;
  onSubmit: (data: {
    content: string;
    xPercent?: number | null;
    yPercent?: number | null;
    page?: number | null;
    requestChanges?: boolean;
    assignAsTask?: { assignedTo: string; dueDate?: string };
  }) => void | Promise<void>;
  onCancel: () => void;
  /** Clear the visual pending pin from the document. */
  onClearPin?: () => void;
  /** Enter pin mode so the user can click the document to place a pin. */
  onRequestPin?: () => void;
}) {
  const [content, setContent] = useState("");
  const [pinAttached, setPinAttached] = useState(!!pendingPin);
  const [assignAsTask, setAssignAsTask] = useState(false);
  const [assignedTo, setAssignedTo] = useState(defaultAssignee ?? "");
  const [dueDate, setDueDate] = useState("");
  const [requestChanges, setRequestChanges] = useState(!!requestChangesMode);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Sync pinAttached when pendingPin changes and auto-focus textarea
  useEffect(() => {
    if (pendingPin) {
      setPinAttached(true);
      textareaRef.current?.focus();
    }
  }, [pendingPin]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    const data: Parameters<typeof onSubmit>[0] = {
      content: content.trim(),
      xPercent: pinAttached && pendingPin ? pendingPin.xPercent : null,
      yPercent: pinAttached && pendingPin ? pendingPin.yPercent : null,
      page: pinAttached && pendingPin ? pendingPin.page : null,
    };
    if (requestChanges) {
      data.requestChanges = true;
    }
    if (assignAsTask && assignedTo) {
      data.assignAsTask = {
        assignedTo,
        dueDate: dueDate || undefined,
      };
    }
    setSubmitting(true);
    try {
      await onSubmit(data);
      setContent("");
      setAssignAsTask(false);
      setAssignedTo(defaultAssignee ?? "");
      setDueDate("");
      setRequestChanges(!!requestChangesMode);
    } finally {
      setSubmitting(false);
    }
  }

  const expandRef = useRef<HTMLDivElement>(null);
  const [expandHeight, setExpandHeight] = useState<number | null>(
    assignAsTask ? null : 0
  );

  // Measure and animate the expand section
  useEffect(() => {
    if (assignAsTask) {
      const el = expandRef.current;
      if (el) {
        // Measure natural height
        el.style.height = "auto";
        const h = el.scrollHeight;
        el.style.height = "0px";
        // Force reflow then animate to measured height
        requestAnimationFrame(() => {
          setExpandHeight(h);
        });
      }
    } else {
      setExpandHeight(0);
    }
  }, [assignAsTask]);

  return (
    <div className="border-b border-border-default p-3">
      {/* Outer card */}
      <div className="rounded-[10px] border border-border-default overflow-hidden flex flex-col bg-bg-secondary">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
          <span className="text-[13px] font-semibold text-text-primary">
            New Comment
          </span>
          <button
            onClick={onCancel}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Textarea area */}
        <div className="mx-3.5 rounded-lg border border-border-default bg-bg-elevated transition-colors duration-200 focus-within:border-accent/30">
          {/* Pin badge row */}
          {pinAttached && pendingPin && (
            <div className="px-2.5 pt-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <button
                onClick={() => {
                  setPinAttached(false);
                  onClearPin?.();
                }}
                className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your comment..."
            rows={4}
            className="w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-[1.5] text-text-primary placeholder:text-text-muted outline-none! focus-visible:outline-none! border-none"
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-end px-2.5 py-1.5 border-t border-border-default/60">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (pinAttached && pendingPin) {
                      setPinAttached(false);
                      onClearPin?.();
                    } else {
                      onRequestPin?.();
                    }
                  }}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    pinAttached && pendingPin
                      ? "text-accent bg-accent/10"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {pinAttached && pendingPin
                  ? "Unpin from document"
                  : "Place a pin on the document"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Request changes — only for PM and Client */}
        {(role === "pm" || role === "client") && (
          <div className="px-3.5 py-2.5 border-t border-border-default/10">
            <Checkbox
              checked={requestChanges}
              onCheckedChange={(checked: boolean) => {
                if (requestChangesMode) return;
                setRequestChanges(checked);
                if (checked) {
                  setPinAttached(true);
                  if (!pendingPin) onRequestPin?.();
                }
              }}
              disabled={requestChangesMode}
              label="Request changes"
              className="[&_span]:text-[12px] [&_span]:text-text-primary"
            />
            {requestChanges && !pendingPin && (
              <p className="text-[12px] text-amber-400 font-medium mt-2 ml-6">
                Click on the document to place a pin
              </p>
            )}
          </div>
        )}

        {/* Assign as task — hidden when requestChanges is checked (task is auto-created) or for clients */}
        {!requestChanges && role !== "client" && (
          <div className="px-3.5 py-2.5 border-t border-border-default/10">
            <Checkbox
              checked={assignAsTask}
              onCheckedChange={setAssignAsTask}
              label="Assign as task"
              className="[&_span]:text-[12px] [&_span]:text-text-primary"
            />
          </div>
        )}

        {/* Animated expand for task fields */}
        {!requestChanges && role !== "client" && (
          <div
            ref={expandRef}
            className="overflow-hidden transition-[height] duration-200 ease-out"
            style={{ height: expandHeight ?? "auto" }}
          >
            <div className="px-3.5 pb-3 flex flex-col gap-2.5 pt-2.5">
              <div className="flex items-center gap-2.5">
                <label className="text-[11px] text-text-secondary w-[60px] shrink-0">
                  Assignee
                </label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="flex-1 h-8 text-[12px] rounded-md border-border-default bg-bg-elevated">
                    <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.length === 0 ? (
                      <div className="px-3 py-2 text-[12px] text-text-muted">
                        No members found
                      </div>
                    ) : (
                      members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2.5">
                <label className="text-[11px] text-text-secondary w-[60px] shrink-0">
                  Due Date
                </label>
                <DatePicker
                  value={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                  onChange={(d) =>
                    setDueDate(
                      d
                        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                        : ""
                    )
                  }
                  placeholder="Select Date"
                  className="flex-1 [&_button]:h-8 [&_button]:text-[12px] [&_button]:rounded-md [&_button]:border-border-default [&_button]:bg-bg-elevated [&_button]:px-2.5 [&_button]:py-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="px-3.5 pb-3.5 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="rounded-lg bg-accent px-5 py-2 text-[13px] font-semibold text-text-on-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
