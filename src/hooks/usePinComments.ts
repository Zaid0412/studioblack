import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import useSWR from "swr";
import { pinComments } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import { API } from "@/lib/api/routes";
import type { DbPinComment, DbPinShape, PinShape, PinShapeType } from "@/types";
import type { PinStatus } from "@/lib/validations";
import { centroidOf, geometryOf } from "@/lib/shapeUtils";

/** Shape drawing tool currently selected in the review toolbar. */
export type DrawTool = PinShapeType | null;

/** Default color used for new shape annotations. Reuses the accent yellow. */
export const DEFAULT_SHAPE_COLOR = "#F5C518";

/** Default stroke thickness in screen pixels. */
export const DEFAULT_SHAPE_STROKE_WIDTH = 2;

/** Default opacity (fully opaque). */
export const DEFAULT_SHAPE_OPACITY = 1;

/** Whether new shapes are filled by default (outline-only). */
export const DEFAULT_SHAPE_FILL = false;

function shapeCentroidXY(shape: PinShape): {
  x: number | null;
  y: number | null;
} {
  const [x, y] = centroidOf(shape);
  return { x, y };
}

/**
 * Build a DbPinShape for optimistic rendering. Real ids replace it when the
 * server response arrives.
 */
function toOptimisticDbShape(
  shape: PinShape,
  pinId: string,
  index: number
): DbPinShape {
  return {
    id: `temp-shape-${pinId}-${index}`,
    pin_comment_id: pinId,
    shape_type: shape.type,
    shape_data: geometryOf(shape),
    shape_color: shape.color,
    shape_stroke_width: shape.strokeWidth,
    shape_opacity: shape.opacity,
    shape_fill: shape.fill,
    order_index: index,
    created_at: new Date().toISOString(),
  };
}

interface UsePinCommentsParams {
  projectId: string;
  attachmentId: string;
  /** Current user name — used for optimistic updates. */
  userName?: string;
}

/** Manages pin comment state with optimistic updates for a given attachment. */
export function usePinComments({
  projectId,
  attachmentId,
  userName = "",
}: UsePinCommentsParams) {
  const swrKey =
    projectId && attachmentId
      ? API.attachmentPins(projectId, attachmentId)
      : null;

  const {
    data: pins = [],
    isLoading: loading,
    mutate: mutatePins,
  } = useSWR<DbPinComment[]>(swrKey, {
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "error",
      });
    },
  });

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinMode, setPinModeRaw] = useState(false);
  const [drawTool, setDrawToolRaw] = useState<DrawTool>(null);
  const [drawColor, setDrawColor] = useState<string>(DEFAULT_SHAPE_COLOR);
  const [drawStrokeWidth, setDrawStrokeWidth] = useState<number>(
    DEFAULT_SHAPE_STROKE_WIDTH
  );
  const [drawOpacity, setDrawOpacity] = useState<number>(DEFAULT_SHAPE_OPACITY);
  const [drawFill, setDrawFill] = useState<boolean>(DEFAULT_SHAPE_FILL);
  /** Replies keyed by parent pin ID — lazily loaded. */
  const [repliesMap, setRepliesMap] = useState<Map<string, DbPinComment[]>>(
    new Map()
  );

  /**
   * Pin mode and shape tools are mutually exclusive. The setPinMode setter
   * must stay a pure forwarder — React invokes updater functions twice under
   * StrictMode/concurrent rendering, so any setState side effect inside the
   * updater fires twice. To evaluate function-form `next` against the latest
   * pinMode without a stale closure (e.g. when consumers call setPinMode
   * twice in the same handler), we track pinMode in a ref kept in sync via
   * an effect and resolve `next` at the top of the setter.
   */
  const pinModeRef = useRef(pinMode);
  useEffect(() => {
    pinModeRef.current = pinMode;
  }, [pinMode]);

  const setPinMode = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const on = typeof next === "function" ? next(pinModeRef.current) : next;
      pinModeRef.current = on;
      setPinModeRaw(on);
      if (on) setDrawToolRaw(null);
    },
    []
  );

  const setDrawTool = useCallback((tool: DrawTool) => {
    setDrawToolRaw(tool);
    if (tool !== null) {
      pinModeRef.current = false;
      setPinModeRaw(false);
    }
  }, []);

  // ── Add pin (optimistic) ──────────────────────────────────────────────

  const addPin = useCallback(
    async (data: {
      xPercent?: number | null;
      yPercent?: number | null;
      page?: number | null;
      content: string;
      requestChanges?: boolean;
      assignAsTask?: { assignedTo: string; dueDate?: string };
      shapes?: ReadonlyArray<PinShape>;
    }) => {
      const tempId = `temp-${Date.now()}`;
      const shapes = data.shapes ?? [];
      const hasShapes = shapes.length > 0;
      // For shape annotations the server derives x/y from the first shape's
      // centroid; mirror that on the optimistic pin so the marker pops in at
      // the right spot before the server response arrives.
      const optimisticXY = hasShapes
        ? shapeCentroidXY(shapes[0])
        : { x: data.xPercent ?? null, y: data.yPercent ?? null };
      const tempPin: DbPinComment = {
        id: tempId,
        attachment_id: attachmentId,
        user_id: "",
        user_name: userName,
        x_percent: optimisticXY.x,
        y_percent: optimisticXY.y,
        page: data.page ?? null,
        content: data.content,
        resolved: false,
        status: "open",
        task_id: null,
        request_approval: false,
        request_changes: data.requestChanges ?? false,
        parent_id: null,
        updated_at: null,
        reply_count: 0,
        created_at: new Date().toISOString(),
        shapes: shapes.map((s, i) => toOptimisticDbShape(s, tempId, i)),
      };
      mutatePins((prev) => [...(prev ?? []), tempPin], { revalidate: false });

      try {
        const pin = await pinComments.create(projectId, attachmentId, {
          x_percent: data.xPercent ?? null,
          y_percent: data.yPercent ?? null,
          page: data.page ?? null,
          content: data.content,
          request_changes: data.requestChanges,
          assign_as_task: data.assignAsTask
            ? {
                assigned_to: data.assignAsTask.assignedTo,
                due_date: data.assignAsTask.dueDate,
              }
            : undefined,
          shapes: hasShapes ? [...shapes] : undefined,
        });
        // Replace temp with real
        mutatePins(
          (prev) => (prev ?? []).map((p) => (p.id === tempId ? pin : p)),
          {
            revalidate: false,
          }
        );
      } catch {
        // Rollback
        mutatePins((prev) => (prev ?? []).filter((p) => p.id !== tempId), {
          revalidate: false,
        });
        toast({
          title: "Error",
          description: "Failed to add comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, userName, mutatePins]
  );

  // ── Resolve ───────────────────────────────────────────────────────────

  const resolvePin = useCallback(
    async (pinId: string, resolved: boolean) => {
      mutatePins(
        (prev) =>
          (prev ?? []).map((p) => (p.id === pinId ? { ...p, resolved } : p)),
        { revalidate: false }
      );
      try {
        await pinComments.resolve(projectId, attachmentId, pinId, resolved);
      } catch {
        mutatePins(
          (prev) =>
            (prev ?? []).map((p) =>
              p.id === pinId ? { ...p, resolved: !resolved } : p
            ),
          { revalidate: false }
        );
        toast({
          title: "Error",
          description: "Failed to update comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, mutatePins]
  );

  // ── Set 3-state status ────────────────────────────────────────────────

  const setPinStatus = useCallback(
    async (pinId: string, status: PinStatus) => {
      mutatePins(
        (prev) =>
          (prev ?? []).map((p) =>
            p.id === pinId
              ? { ...p, status, resolved: status === "resolved" }
              : p
          ),
        { revalidate: false }
      );
      try {
        await pinComments.setStatus(projectId, attachmentId, pinId, status);
      } catch {
        mutatePins(); // revalidate from server
        toast({
          title: "Error",
          description: "Failed to update status",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, mutatePins]
  );

  // ── Edit content ──────────────────────────────────────────────────────

  const editPin = useCallback(
    async (pinId: string, content: string) => {
      mutatePins(
        (prev) =>
          (prev ?? []).map((p) =>
            p.id === pinId
              ? { ...p, content, updated_at: new Date().toISOString() }
              : p
          ),
        { revalidate: false }
      );
      try {
        await pinComments.editContent(projectId, attachmentId, pinId, content);
      } catch {
        mutatePins(); // revalidate from server
        toast({
          title: "Error",
          description: "Failed to edit comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, mutatePins]
  );

  // ── Delete ────────────────────────────────────────────────────────────

  const deletePin = useCallback(
    async (pinId: string) => {
      mutatePins((prev) => (prev ?? []).filter((pin) => pin.id !== pinId), {
        revalidate: false,
      });
      setSelectedPinId((prev) => (prev === pinId ? null : prev));
      try {
        await pinComments.remove(projectId, attachmentId, pinId);
      } catch {
        mutatePins(); // revalidate from server
        toast({
          title: "Error",
          description: "Failed to delete comment",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, mutatePins]
  );

  // ── Reposition ────────────────────────────────────────────────────────

  const repositionPin = useCallback(
    async (pinId: string, xPercent: number, yPercent: number, page: number) => {
      mutatePins(
        (prev) =>
          (prev ?? []).map((p) =>
            p.id === pinId
              ? { ...p, x_percent: xPercent, y_percent: yPercent, page }
              : p
          ),
        { revalidate: false }
      );
      try {
        await pinComments.reposition(projectId, attachmentId, pinId, {
          x_percent: xPercent,
          y_percent: yPercent,
          page,
        });
      } catch {
        mutatePins(); // revalidate from server
        toast({
          title: "Error",
          description: "Failed to reposition pin",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, mutatePins]
  );

  // ── Replies ───────────────────────────────────────────────────────────

  const fetchReplies = useCallback(
    async (parentId: string) => {
      try {
        const replies = await pinComments.listReplies(
          projectId,
          attachmentId,
          parentId
        );
        setRepliesMap((prev) => {
          const next = new Map(prev);
          next.set(parentId, replies);
          return next;
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to load replies",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId]
  );

  const addReply = useCallback(
    async (parentId: string, content: string) => {
      try {
        const reply = await pinComments.create(projectId, attachmentId, {
          content,
          parent_id: parentId,
        });
        // Update replies map
        setRepliesMap((prev) => {
          const next = new Map(prev);
          const existing = next.get(parentId) ?? [];
          next.set(parentId, [...existing, reply]);
          return next;
        });
        // Increment reply_count on parent
        mutatePins(
          (prev) =>
            (prev ?? []).map((p) =>
              p.id === parentId
                ? { ...p, reply_count: (p.reply_count ?? 0) + 1 }
                : p
            ),
          { revalidate: false }
        );
      } catch {
        toast({
          title: "Error",
          description: "Failed to add reply",
          variant: "error",
        });
      }
    },
    [projectId, attachmentId, mutatePins]
  );

  // "Open" = needs attention. Closed pins are dismissed, not open, so they
  // don't count toward the badge.
  const unresolvedCount = useMemo(
    () => pins.filter((p) => p.status === "open").length,
    [pins]
  );

  return {
    pins,
    loading,
    selectedPinId,
    setSelectedPinId,
    pinMode,
    setPinMode,
    drawTool,
    setDrawTool,
    drawColor,
    setDrawColor,
    drawStrokeWidth,
    setDrawStrokeWidth,
    drawOpacity,
    setDrawOpacity,
    drawFill,
    setDrawFill,
    addPin,
    resolvePin,
    setPinStatus,
    editPin,
    deletePin,
    repositionPin,
    repliesMap,
    fetchReplies,
    addReply,
    unresolvedCount,
  };
}
