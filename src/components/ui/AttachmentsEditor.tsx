"use client";

import { useState } from "react";
import { Paperclip, X } from "lucide-react";
import { FileUploadSlot } from "@/components/ui/FileUploadSlot";
import { Input } from "@/components/ui/input";
import { splitFileName } from "@/lib/fileUtils";

export interface AttachmentRef {
  url: string;
  fileName: string;
  /** File extension, derived on upload (e.g. "pdf"). Optional for older rows. */
  fileType?: string | null;
  /** Free-text note for the file — only surfaced when `withNotes` is set. */
  notes?: string | null;
}

interface Props {
  value: AttachmentRef[];
  onChange: (next: AttachmentRef[]) => void;
  /** Cap on the number of files. Default 20. */
  max?: number;
  /** aria-label for each remove button. */
  removeLabel?: string;
  /** Show a per-file notes input (quote evidence, §15). Off by default. */
  withNotes?: boolean;
  /** Placeholder for the per-file notes input. */
  notesPlaceholder?: string;
}

/** Extension of a filename (lowercased, capped), or null when there isn't one. */
function extensionOf(fileName: string): string | null {
  const { ext } = splitFileName(fileName); // ".pdf" | "" (also handles dotfiles)
  return ext ? ext.slice(1).toLowerCase().slice(0, 20) : null;
}

/**
 * Multi-file attachments editor — a list of removable {url, fileName} rows plus
 * an upload slot. Shared by the vendor-quote evidence uploader and the RFQ
 * per-line attachments dialog so the upload behaviour (limit, reset, wiring)
 * lives in one place. With `withNotes`, each row also gets a note input; the
 * file's extension is captured as `fileType` on upload either way.
 */
export function AttachmentsEditor({
  value,
  onChange,
  max = 20,
  removeLabel,
  withNotes = false,
  notesPlaceholder,
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
              className="flex flex-col gap-1 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
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
              </div>
              {withNotes && (
                <Input
                  value={f.notes ?? ""}
                  onChange={(e) =>
                    onChange(
                      value.map((g, j) =>
                        j === i ? { ...g, notes: e.target.value } : g
                      )
                    )
                  }
                  placeholder={notesPlaceholder}
                  className="text-xs"
                />
              )}
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
            onChange([
              ...value,
              { url, fileName, fileType: extensionOf(fileName) },
            ]);
            setUploadKey((k) => k + 1);
          }}
          onCleared={() => {}}
        />
      )}
    </div>
  );
}
