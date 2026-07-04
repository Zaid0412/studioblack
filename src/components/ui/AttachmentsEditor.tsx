"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";

export interface AttachmentRef {
  url: string;
  fileName: string;
}

interface Props {
  value: AttachmentRef[];
  onChange: (next: AttachmentRef[]) => void;
  /** Cap on the number of files. Default 20. */
  max?: number;
  /** aria-label for each remove button. */
  removeLabel?: string;
}

/**
 * Multi-file attachments editor — a list of removable {url, fileName} rows plus
 * an upload slot. Shared by the vendor-quote evidence uploader and the RFQ
 * per-line attachments dialog so the upload behaviour (limit, reset, wiring)
 * lives in one place.
 */
export function AttachmentsEditor({
  value,
  onChange,
  max = 20,
  removeLabel,
}: Props) {
  // Bumping the key remounts FileUploadSlot so it resets to the empty state
  // after each successful upload (the slot is single-shot).
  const [uploadKey, setUploadKey] = useState(0);

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((f, i) => (
            <li
              key={f.url}
              className="flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm"
            >
              <Paperclip className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 truncate text-text-secondary hover:text-text-primary"
              >
                {f.fileName}
              </a>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={removeLabel}
                className="text-text-muted hover:text-error transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length < max && (
        <FileUploadSlot
          key={uploadKey}
          variant="file"
          url={null}
          onUploaded={({ url, fileName }) => {
            onChange([...value, { url, fileName }]);
            setUploadKey((k) => k + 1);
          }}
          onCleared={() => {}}
        />
      )}
    </div>
  );
}
