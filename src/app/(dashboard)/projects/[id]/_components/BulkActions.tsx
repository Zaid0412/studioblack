"use client";

import {
  Download,
  Check,
  X,
  Lock,
  Trash2,
  Send,
  ClipboardCheck,
} from "lucide-react";

interface BulkActionsProps {
  variant: "desktop" | "mobile";
  isClient: boolean;
  isStaff: boolean;
  onDownload: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSendToClient: () => void;
  onMarkReviewed: () => void;
  onFreeze: () => void;
  onRemove: () => void;
}

/** Shared bulk action buttons for desktop and mobile file selection. */
export function BulkActions({
  variant,
  isClient,
  isStaff,
  onDownload,
  onApprove,
  onReject,
  onSendToClient,
  onMarkReviewed,
  onFreeze,
  onRemove,
}: BulkActionsProps) {
  if (variant === "desktop") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-text-secondary bg-bg-elevated/30 border border-border-default hover:bg-bg-elevated/50 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
        {isClient && (
          <>
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-emerald-400 bg-emerald-400/[0.08] border border-emerald-400/20 hover:bg-emerald-400/[0.15] transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Approve
            </button>
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reject
            </button>
          </>
        )}
        {isStaff && (
          <>
            <button
              onClick={onSendToClient}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-text-secondary bg-bg-elevated/30 border border-border-default hover:bg-bg-elevated/50 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Send to Client
            </button>
            <button
              onClick={onMarkReviewed}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-text-secondary bg-bg-elevated/30 border border-border-default hover:bg-bg-elevated/50 transition-colors cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Mark Reviewed
            </button>
            <button
              onClick={onFreeze}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-accent-strong bg-accent/[0.08] border border-accent-strong/20 hover:bg-accent/[0.15] transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Freeze Design
            </button>
            <button
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </>
        )}
      </div>
    );
  }

  // Mobile variant — icon-only buttons
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onDownload}
        className="p-2 rounded-md text-text-secondary bg-bg-elevated border border-border-default hover:bg-bg-elevated/80 transition-colors cursor-pointer"
        aria-label="Download selected"
      >
        <Download className="w-4 h-4" />
      </button>
      {isClient && (
        <>
          <button
            onClick={onApprove}
            className="p-2 rounded-md text-emerald-400 bg-emerald-400/[0.08] border border-emerald-400/20 hover:bg-emerald-400/[0.15] transition-colors cursor-pointer"
            aria-label="Approve selected"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onReject}
            className="p-2 rounded-md text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
            aria-label="Reject selected"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      {isStaff && (
        <>
          <button
            onClick={onSendToClient}
            className="p-2 rounded-md text-text-secondary bg-bg-elevated border border-border-default hover:bg-bg-elevated/80 transition-colors cursor-pointer"
            aria-label="Send to client"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={onFreeze}
            className="p-2 rounded-md text-accent-strong bg-accent/[0.08] border border-accent-strong/20 hover:bg-accent/[0.15] transition-colors cursor-pointer"
            aria-label="Freeze design"
          >
            <Lock className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-2 rounded-md text-red-400 bg-red-400/[0.08] border border-red-400/20 hover:bg-red-400/[0.15] transition-colors cursor-pointer"
            aria-label="Remove selected"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
