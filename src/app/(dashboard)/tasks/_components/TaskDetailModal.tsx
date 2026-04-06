"use client";

import { createPortal } from "react-dom";
import {
  Calendar,
  Edit,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  Star,
  X,
  ListChecks,
  Paperclip,
  Download,
  Upload,
  Eye,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { avatarColor } from "@/lib/avatarUtils";
import {
  PRIORITY_DOT,
  STATUS_DOT,
  STATUS_LABEL,
  PRIORITY_LABEL,
  initials,
  capitalize,
  formatFullDate,
  isOverdue,
} from "@/lib/taskUtils";
import type { Task } from "@/types";
import { useTaskDetail, type ChecklistItem } from "../_hooks/useTaskDetail";

// ---------------------------------------------------------------------------
// File type color helpers
// ---------------------------------------------------------------------------

function getFileExtension(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

function fileTypeBadge(ext: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (ext) {
    case "pdf":
      return { bg: "#1E3A5F", text: "#60A5FA", label: "PDF" };
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return { bg: "#1E3F1E", text: "#4ADE80", label: ext.toUpperCase() };
    case "dwg":
    case "ai":
    case "psd":
    case "sketch":
      return { bg: "#2D1E5F", text: "#A78BFA", label: ext.toUpperCase() };
    case "svg":
      return { bg: "#3F2E1E", text: "#FB923C", label: "SVG" };
    default:
      return {
        bg: "var(--bg-elevated)",
        text: "var(--text-secondary)",
        label: ext.toUpperCase() || "FILE",
      };
  }
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "svg", "gif"]);
const PDF_EXTS = new Set(["pdf"]);

function isPreviewable(ext: string): boolean {
  return IMAGE_EXTS.has(ext);
}

function isOpenable(ext: string): boolean {
  return PDF_EXTS.has(ext) || IMAGE_EXTS.has(ext);
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
  onToggleStatus: (task: Task) => void;
  onToggleStar?: (task: Task) => void;
  onDelete: (task: Task) => void;
  onChecklistChange?: () => void;
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center h-9 px-3.5 gap-0">
      <span className="text-xs text-text-muted w-[90px] shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  );
}

function DetailSep() {
  return <div className="h-px bg-bg-secondary" />;
}

// ---------------------------------------------------------------------------
// Sortable checklist item
// ---------------------------------------------------------------------------

function SortableChecklistItem({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistItem;
  onToggle: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 group py-1.5 px-1 rounded hover:bg-bg-elevated/50"
    >
      <button
        {...attributes}
        {...listeners}
        className="p-0 shrink-0 text-text-muted hover:text-text-secondary cursor-grab active:cursor-grabbing transition-colors touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onToggle(item)}
        className={`w-4 h-4 rounded-[3px] border shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
          item.is_done
            ? "bg-accent border-accent"
            : "border-text-muted hover:border-text-secondary"
        }`}
      >
        {item.is_done && (
          <svg
            className="w-3 h-3 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>
      <span
        className={`text-[13px] flex-1 ${
          item.is_done ? "text-text-muted line-through" : "text-text-secondary"
        }`}
      >
        {item.title}
      </span>
      <button
        onClick={() => onDelete(item)}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Read-only task detail modal with action buttons. */
export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onEdit,
  onToggleStatus,
  onToggleStar,
  onDelete,
  onChecklistChange,
}: TaskDetailModalProps) {
  const router = useRouter();

  const {
    checklistItems,
    loadingChecklist,
    newItemTitle,
    setNewItemTitle,
    addingItem,
    addItem,
    toggleItem,
    deleteItem,
    handleDragEnd,
    attachments,
    loadingAttachments,
    uploading,
    handleUpload,
    handleDownload,
    deleteAttachment,
    fileInputRef,
    previewId,
    setPreviewId,
    previewLoading,
    setPreviewLoading,
    lightboxUrl,
    setLightboxUrl,
  } = useTaskDetail(task, open, onChecklistChange);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!task) return null;

  const doneCount = checklistItems.filter((i) => i.is_done).length;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && lightboxUrl) {
            setLightboxUrl(null);
            return;
          }
          onOpenChange(v);
        }}
      >
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          {/* Star button — aligned vertically with the dialog close X */}
          {onToggleStar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onToggleStar(task)}
                  className="absolute right-11 top-4 p-0 rounded transition-colors cursor-pointer z-10"
                >
                  <Star
                    className={`w-4 h-4 ${
                      task.is_starred
                        ? "fill-accent text-accent"
                        : "text-text-muted hover:text-accent"
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>{task.is_starred ? "Unstar" : "Star"}</TooltipContent>
            </Tooltip>
          )}
          {/* Header */}
          <DialogHeader className="px-6 pr-20 pt-5 pb-4">
            <div className="flex items-center gap-2.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                  />
                </TooltipTrigger>
                <TooltipContent>{PRIORITY_LABEL[task.priority]}</TooltipContent>
              </Tooltip>
              <DialogTitle className="text-base font-semibold flex-1">
                {task.title}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="h-px bg-border-default" />

          {/* Body */}
          <div className="flex flex-col gap-4 px-6 py-4 max-h-[60vh] overflow-y-auto">
            {/* Description */}
            {task.description ? (
              <p className="text-[13px] text-text-secondary whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-[13px] text-text-muted italic">
                No description
              </p>
            )}

            {/* Details card */}
            <div className="flex flex-col rounded-lg bg-bg-secondary overflow-hidden shrink-0">
              <DetailRow label="Status">
                <span
                  className={`w-[7px] h-[7px] rounded-full ${STATUS_DOT[task.status] ?? "bg-gray-400"}`}
                />
                <span className="text-xs font-medium text-text-primary">
                  {STATUS_LABEL[task.status] ?? task.status}
                </span>
              </DetailRow>
              <DetailSep />
              <DetailRow label="Priority">
                <span
                  className={`w-[7px] h-[7px] rounded-full ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
                />
                <span className="text-xs font-medium text-text-primary">
                  {PRIORITY_LABEL[task.priority]}
                </span>
              </DetailRow>
              <DetailSep />
              <DetailRow label="Project">
                {task.project_name ? (
                  <a
                    href={
                      task.pin_comment_id && task.pin_attachment_id
                        ? `/projects/${task.project_id}/review/${task.pin_attachment_id}?comments=open&pinId=${task.pin_comment_id}`
                        : `/projects/${task.project_id}?highlightTask=${task.id}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-500/20 transition-colors"
                  >
                    {task.project_name}
                  </a>
                ) : (
                  <span className="text-xs text-text-muted">&mdash;</span>
                )}
              </DetailRow>
              <DetailSep />
              <DetailRow label="Phase">
                {task.phase_name ? (
                  <span className="text-xs text-text-secondary">
                    {task.phase_name}
                  </span>
                ) : (
                  <span className="text-xs text-text-muted">&mdash;</span>
                )}
              </DetailRow>
              <DetailSep />
              <DetailRow label="Category">
                <span className="text-[11px] font-medium text-text-secondary bg-bg-secondary px-2 py-0.5 rounded">
                  {capitalize(task.category)}
                </span>
              </DetailRow>
              <DetailSep />
              <DetailRow label="Assignee">
                {task.assigned_to_name ? (
                  <>
                    <Avatar
                      initials={initials(task.assigned_to_name)}
                      size="sm"
                      color={avatarColor(task.assigned_to_name)}
                    />
                    <span className="text-xs text-text-primary">
                      {task.assigned_to_name}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-text-muted">Unassigned</span>
                )}
              </DetailRow>
              <DetailSep />
              <DetailRow label="Due">
                {task.due_date ? (
                  <>
                    <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                    <span
                      className={`text-xs ${
                        isOverdue(task.due_date, task.status)
                          ? "text-red-500"
                          : "text-text-secondary"
                      }`}
                    >
                      {formatFullDate(task.due_date)}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-text-muted">&mdash;</span>
                )}
              </DetailRow>
              <DetailSep />
              <DetailRow label="Created">
                <span className="text-xs text-text-secondary">
                  {formatFullDate(task.created_at)} by {task.created_by_name}
                </span>
              </DetailRow>
              {task.completed_at && (
                <>
                  <DetailSep />
                  <DetailRow label="Completed">
                    <span className="text-xs text-green-400">
                      {formatFullDate(task.completed_at)}
                    </span>
                  </DetailRow>
                </>
              )}
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-2.5 border-t border-border-default pt-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Checklist
                  </span>
                </div>
                {checklistItems.length > 0 && (
                  <span className="text-[11px] text-text-muted">
                    {doneCount}/{checklistItems.length} completed
                  </span>
                )}
              </div>
              {loadingChecklist ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                </div>
              ) : (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addItem();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder="Add item..."
                      className="flex-1 text-[13px] bg-transparent border border-border-default rounded px-2.5 py-1.5 text-text-primary placeholder:text-text-muted outline-none focus:border-accent transition-colors"
                      disabled={addingItem}
                    />
                    <button
                      type="submit"
                      disabled={!newItemTitle.trim() || addingItem}
                      className="px-3 py-1.5 rounded bg-accent text-black text-xs font-semibold disabled:opacity-30 hover:bg-accent/90 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </form>
                  {checklistItems.length > 0 && (
                    <div className="w-full h-[3px] rounded-full bg-border-default overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-200"
                        style={{
                          width: `${(doneCount / checklistItems.length) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={checklistItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col gap-0.5">
                        {checklistItems.map((item) => (
                          <SortableChecklistItem
                            key={item.id}
                            item={item}
                            onToggle={toggleItem}
                            onDelete={deleteItem}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>

            {/* Attachments */}
            <div className="flex flex-col gap-2.5 border-t border-border-default pt-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    Attachments
                  </span>
                </div>
                {attachments.length > 0 && (
                  <span className="text-[11px] text-text-muted">
                    {attachments.length} file
                    {attachments.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {loadingAttachments ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                </div>
              ) : attachments.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {attachments.map((att) => {
                    const ext = getFileExtension(att.file_name);
                    const badge = fileTypeBadge(ext);
                    const canPreview = isPreviewable(ext);
                    const canOpen = isOpenable(ext);
                    const isPreviewing = previewId === att.id;
                    const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(att.file_url)}`;
                    return (
                      <div key={att.id} className="flex flex-col">
                        <div className="flex items-center gap-2.5 group py-1.5 px-2 rounded hover:bg-bg-elevated/50">
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              backgroundColor: badge.bg,
                              color: badge.text,
                            }}
                          >
                            {badge.label}
                          </span>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[13px] text-text-primary truncate">
                              {att.file_name}
                            </span>
                            <span className="text-[11px] text-text-secondary">
                              {formatFileSize(att.file_size)}
                              {att.file_size != null && " · "}
                              {formatFullDate(att.created_at)}
                            </span>
                          </div>
                          {canPreview && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (isPreviewing) {
                                      setPreviewId(null);
                                      setPreviewLoading(null);
                                    } else {
                                      setPreviewLoading(att.id);
                                      setPreviewId(att.id);
                                    }
                                  }}
                                  className={`p-1 rounded transition-colors cursor-pointer ${isPreviewing ? "text-accent" : "text-text-muted hover:text-text-primary"}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{isPreviewing ? "Hide preview" : "Preview"}</TooltipContent>
                            </Tooltip>
                          )}
                          {canOpen && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={proxyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent>Open in new tab</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleDownload(att)}
                                className="p-1 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Download</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => deleteAttachment(att)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-red-400 transition-all cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                        {canPreview && isPreviewing && (
                          <div className="px-2 pb-2 relative">
                            {previewLoading === att.id && (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-4 h-4 text-text-muted animate-spin" />
                              </div>
                            )}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={proxyUrl}
                              alt={att.file_name}
                              className={`w-full max-h-48 object-contain rounded bg-bg-primary border border-border-default cursor-pointer hover:opacity-90 transition-opacity ${previewLoading === att.id ? "hidden" : ""}`}
                              onLoadStart={() => setPreviewLoading(att.id)}
                              onLoad={() => setPreviewLoading(null)}
                              onError={() => setPreviewLoading(null)}
                              onClick={() => setLightboxUrl(proxyUrl)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded border border-dashed border-border-default text-text-muted hover:border-border-light hover:text-text-secondary transition-colors text-[13px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploading ? "Uploading..." : "Upload file"}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="h-px bg-border-default" />
          <DialogFooter className="flex-row justify-between sm:justify-between px-6 py-3">
            <div className="flex gap-2">
              {task.project_id && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    if (task.pin_comment_id && task.pin_attachment_id) {
                      router.push(
                        `/projects/${task.project_id}/review/${task.pin_attachment_id}?comments=open&pinId=${task.pin_comment_id}`
                      );
                    } else {
                      router.push(
                        `/projects/${task.project_id}?highlightTask=${task.id}`
                      );
                    }
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Go to Project
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(task);
                }}
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onToggleStatus(task)}
              >
                {task.status === "completed" ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reopen
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete
                  </>
                )}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(task);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen lightbox — portaled above the dialog overlay */}
      {lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90"
            style={{ cursor: "pointer", pointerEvents: "auto" }}
            onClick={() => setLightboxUrl(null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setLightboxUrl(null);
              }
            }}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(null);
              }}
            >
              <X className="w-5 h-5 text-white" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Preview"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
