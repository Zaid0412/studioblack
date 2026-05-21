import type { PinShape, PinShapeData } from "@/types";

/** Percent-based 2D point. */
export type Point = readonly [number, number];

/**
 * Strip the geometry out of a wire-format `PinShape` (geometry + style mixed)
 * into the bare `PinShapeData` shape used by the `shape_data` column and the
 * SVG renderer.
 */
export function geometryOf(shape: PinShape): PinShapeData {
  if (shape.type === "rectangle")
    return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
  if (shape.type === "circle")
    return { cx: shape.cx, cy: shape.cy, rx: shape.rx, ry: shape.ry };
  return { points: shape.points };
}

/**
 * Centroid of a shape in percent coords. Used as the anchor point we store in
 * `x_percent` / `y_percent` so the existing pin selection / sidebar logic keeps
 * working unchanged for shape annotations.
 */
export function centroidOf(shape: PinShape): Point {
  switch (shape.type) {
    case "rectangle":
      return [shape.x + shape.w / 2, shape.y + shape.h / 2];
    case "circle":
      return [shape.cx, shape.cy];
    case "freehand": {
      const { points } = shape;
      if (points.length === 0) {
        // A freehand shape with zero points is malformed — the centroid is
        // undefined. Returning [0, 0] silently anchors the pin at the top-left
        // of the document, masking the bug. Fail loudly instead.
        throw new Error("centroidOf: freehand shape has no points");
      }
      let sx = 0;
      let sy = 0;
      for (const [px, py] of points) {
        sx += px;
        sy += py;
      }
      return [sx / points.length, sy / points.length];
    }
  }
}

/** Axis-aligned bounding box in percent coords: { x, y, w, h }. */
export function boundingBoxOf(shape: PinShape): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  switch (shape.type) {
    case "rectangle":
      return { x: shape.x, y: shape.y, w: shape.w, h: shape.h };
    case "circle":
      return {
        x: shape.cx - shape.rx,
        y: shape.cy - shape.ry,
        w: shape.rx * 2,
        h: shape.ry * 2,
      };
    case "freehand": {
      const { points } = shape;
      if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      let minX = points[0][0];
      let maxX = minX;
      let minY = points[0][1];
      let maxY = minY;
      for (const [px, py] of points) {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
}

/** Perpendicular distance from point `p` to the line through `a` and `b`. */
function perpDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = p[0] - a[0];
    const ey = p[1] - a[1];
    return Math.sqrt(ex * ex + ey * ey);
  }
  const num = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]);
  return num / Math.sqrt(len2);
}

/**
 * Ramer–Douglas–Peucker polyline simplification. `epsilon` is in the same units
 * as the points (percent). Drops points that lie within `epsilon` of the line
 * between their neighbors. Used to keep freehand stroke storage reasonable.
 */
export function simplifyPath(
  points: ReadonlyArray<Point>,
  epsilon: number
): Point[] {
  if (points.length <= 2) return points.slice() as Point[];
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, index + 1), epsilon);
    const right = simplifyPath(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

/**
 * Smallest dimension along either axis a shape covers, in percent. Used to
 * reject accidental near-zero-area drawings before submitting.
 */
export function shapeMinExtent(shape: PinShape): number {
  const bbox = boundingBoxOf(shape);
  return Math.min(bbox.w, bbox.h);
}
