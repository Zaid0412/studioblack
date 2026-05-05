"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Heading,
  Bold,
  Italic,
  Quote,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListChecks,
  Image as ImageIcon,
  Paperclip,
} from "lucide-react";
import { upload } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { MAX_UPLOAD_SIZE } from "@/lib/fileUtils";

interface TaskMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Inline-block height of the textarea (px). Defaults to 320. */
  minHeight?: number;
}

type Tab = "write" | "preview";

/**
 * GitHub-style markdown editor used by `/tasks/new`, `/tasks/[id]` (when
 * editing), and the side panel composer. Plain textarea with a toolbar that
 * inserts markdown syntax + paste/drop file handling that uploads and inlines
 * the file as `![]()` or `[]()`. Preview tab renders via `react-markdown`
 * with GitHub-flavored markdown (task lists, tables, autolinks).
 */
export function TaskMarkdownEditor({
  value,
  onChange,
  placeholder = "Type, paste an image, or drop a file…",
  minHeight = 320,
}: TaskMarkdownEditorProps) {
  const [tab, setTab] = useState<Tab>("write");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mirror `value` so async uploads can replace placeholders against the
  // latest text without going stale through closures.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const placeholderCounterRef = useRef(0);

  // ─── Selection helpers ────────────────────────────────────────────────────

  const surroundSelection = useCallback(
    (before: string, after = before) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next =
        value.slice(0, start) +
        before +
        value.slice(start, end) +
        after +
        value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, end + before.length);
      });
    },
    [value, onChange]
  );

  const insertAtLineStart = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      // Walk back to the start of the current line.
      let lineStart = start;
      while (lineStart > 0 && value[lineStart - 1] !== "\n") lineStart--;
      const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + prefix.length, start + prefix.length);
      });
    },
    [value, onChange]
  );

  const insertAtCursor = useCallback(
    (text: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        onChange(value + text);
        return;
      }
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = value.slice(0, start) + text + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start + text.length, start + text.length);
      });
    },
    [value, onChange]
  );

  // ─── File upload (drag-drop / paste / click paperclip) ────────────────────

  /**
   * Drop/paste/click upload flow. For each file we:
   *  1. Insert a unique placeholder at the cursor (`[Uploading file.png…](#upload-N)`).
   *  2. Kick off the upload.
   *  3. On success, swap the placeholder for the final markdown image/link.
   *  4. On error, swap it for a `[Upload failed: file.png]()` marker and toast.
   *
   * The placeholder counter + ref to the latest value mean we don't lose
   * track of which slot belongs to which upload, even when the user types
   * around them mid-upload.
   */
  const uploadAndInsert = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const valid = files.filter((f) => {
        if (f.size > MAX_UPLOAD_SIZE) {
          toast({
            title: "File too large",
            description: `${f.name} exceeds the 50 MB limit.`,
            variant: "error",
          });
          return false;
        }
        return true;
      });
      if (valid.length === 0) return;

      // Build unique placeholders + insert all at once at the current cursor.
      const tasks = valid.map((file) => {
        placeholderCounterRef.current += 1;
        const id = placeholderCounterRef.current;
        return {
          file,
          placeholder: `[Uploading ${file.name}…](#upload-${id})`,
        };
      });
      const insertion = tasks.map((t) => t.placeholder).join("\n") + "\n";
      insertAtCursor(insertion);

      const replaceInValue = (from: string, to: string) => {
        const current = valueRef.current;
        if (!current.includes(from)) return; // user removed it — give up
        onChangeRef.current(current.replace(from, to));
      };

      setUploading((n) => n + valid.length);
      try {
        await Promise.all(
          tasks.map(async ({ file, placeholder }) => {
            try {
              const result = await upload.uploadFile(file);
              const isImage = file.type.startsWith("image/");
              const finalSnippet = isImage
                ? `![${file.name}](${result.url})`
                : `[${file.name}](${result.url})`;
              replaceInValue(placeholder, finalSnippet);
            } catch (err) {
              replaceInValue(placeholder, `[Upload failed: ${file.name}]()`);
              toast({
                title: "Upload failed",
                description:
                  err instanceof Error
                    ? err.message
                    : `Couldn't upload ${file.name}`,
                variant: "error",
              });
            }
          })
        );
      } finally {
        setUploading((n) => Math.max(0, n - valid.length));
      }
    },
    [insertAtCursor]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files ?? []);
      void uploadAndInsert(files);
    },
    [uploadAndInsert]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const files = items
        .filter((i) => i.kind === "file")
        .map((i) => i.getAsFile())
        .filter((f): f is File => f != null);
      if (files.length > 0) {
        e.preventDefault();
        void uploadAndInsert(files);
      }
    },
    [uploadAndInsert]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) void uploadAndInsert(files);
    e.target.value = "";
  };

  // Keyboard shortcuts: Cmd/Ctrl+B, +I, +K
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        surroundSelection("**");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        surroundSelection("_");
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        surroundSelection("[", "]()");
      }
    },
    [surroundSelection]
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-2 border-b border-border-default">
        <TabButton active={tab === "write"} onClick={() => setTab("write")}>
          Write
        </TabButton>
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
          Preview
        </TabButton>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border-default flex-wrap">
        <ToolbarButton
          label="Heading"
          onClick={() => insertAtLineStart("### ")}
          icon={Heading}
        />
        <ToolbarButton
          label="Bold (⌘B)"
          onClick={() => surroundSelection("**")}
          icon={Bold}
        />
        <ToolbarButton
          label="Italic (⌘I)"
          onClick={() => surroundSelection("_")}
          icon={Italic}
        />
        <Divider />
        <ToolbarButton
          label="Quote"
          onClick={() => insertAtLineStart("> ")}
          icon={Quote}
        />
        <ToolbarButton
          label="Code"
          onClick={() => surroundSelection("`")}
          icon={Code}
        />
        <ToolbarButton
          label="Link (⌘K)"
          onClick={() => surroundSelection("[", "]()")}
          icon={LinkIcon}
        />
        <Divider />
        <ToolbarButton
          label="Bulleted list"
          onClick={() => insertAtLineStart("- ")}
          icon={List}
        />
        <ToolbarButton
          label="Numbered list"
          onClick={() => insertAtLineStart("1. ")}
          icon={ListOrdered}
        />
        <ToolbarButton
          label="Task list"
          onClick={() => insertAtLineStart("- [ ] ")}
          icon={ListChecks}
        />
        <Divider />
        <ToolbarButton
          label="Image"
          onClick={() => fileInputRef.current?.click()}
          icon={ImageIcon}
        />
        <ToolbarButton
          label="Attach file"
          onClick={() => fileInputRef.current?.click()}
          icon={Paperclip}
        />
      </div>

      {/* Body */}
      {tab === "write" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            style={{ minHeight }}
            className={`w-full px-4 py-3 text-sm text-text-primary placeholder:text-text-muted bg-bg-primary outline-none resize-y leading-relaxed ${
              dragOver ? "ring-2 ring-accent ring-inset" : ""
            }`}
          />
          {dragOver && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/5 text-accent text-sm font-medium">
              Drop to upload
            </div>
          )}
        </div>
      ) : (
        <div
          className="markdown-preview px-4 py-3 text-sm text-text-primary leading-relaxed"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-text-muted italic">Nothing to preview.</p>
          )}
        </div>
      )}

      {/* Footer hint */}
      <div
        className={`flex items-center gap-2 px-3 py-2 border-t border-border-default text-[11px] transition-colors ${
          uploading > 0
            ? "bg-accent/10 text-accent"
            : "bg-bg-primary/40 text-text-muted"
        }`}
      >
        {uploading > 0 ? <Loader2Spinner /> : <Paperclip className="w-3 h-3" />}
        <span className="flex-1">
          {uploading > 0
            ? `Uploading ${uploading} file${uploading === 1 ? "" : "s"}…`
            : "Attach files by dragging here, pasting, or selecting."}
        </span>
        <span className="text-text-muted">Markdown supported</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFilesChange}
      />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
        active
          ? "bg-bg-primary text-text-primary border border-border-default border-b-0"
          : "text-text-muted hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ElementType;
  disabled?: boolean;
}

function ToolbarButton({
  label,
  onClick,
  icon: Icon,
  disabled,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded transition-colors ${
        disabled
          ? "text-text-muted/40 cursor-not-allowed"
          : "text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 cursor-pointer"
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-border-default mx-0.5" />;
}

function Loader2Spinner() {
  return (
    <svg
      className="w-3 h-3 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}
