import { describe, it, expect } from "vitest";
import {
  centroidOf,
  boundingBoxOf,
  simplifyPath,
  shapeMinExtent,
} from "@/lib/shapeUtils";
import type { PinShape, PinShapeStyle } from "@/types";

/**
 * Shared style fields every PinShape requires. Tests don't care about the
 * actual values — they care about geometry — so we stamp the same baseline
 * style onto every fixture and keep the test bodies focused on coordinates.
 */
const STYLE: PinShapeStyle = {
  color: "#dc2626",
  strokeWidth: 2,
  opacity: 1,
  fill: false,
};

const mkRect = (x: number, y: number, w: number, h: number): PinShape => ({
  type: "rectangle",
  x,
  y,
  w,
  h,
  ...STYLE,
});

const mkCircle = (
  cx: number,
  cy: number,
  rx: number,
  ry: number
): PinShape => ({ type: "circle", cx, cy, rx, ry, ...STYLE });

const mkPath = (points: Array<[number, number]>): PinShape => ({
  type: "freehand",
  points,
  ...STYLE,
});

describe("centroidOf", () => {
  it("returns rectangle center", () => {
    expect(centroidOf(mkRect(10, 20, 30, 40))).toEqual([25, 40]);
  });

  it("returns circle center", () => {
    expect(centroidOf(mkCircle(50, 60, 5, 5))).toEqual([50, 60]);
  });

  it("returns freehand mean", () => {
    expect(
      centroidOf(
        mkPath([
          [0, 0],
          [10, 20],
          [20, 40],
        ])
      )
    ).toEqual([10, 20]);
  });

  it("throws for empty freehand", () => {
    expect(() => centroidOf(mkPath([]))).toThrow();
  });
});

describe("boundingBoxOf", () => {
  it("returns rectangle as-is", () => {
    expect(boundingBoxOf(mkRect(10, 20, 30, 40))).toEqual({
      x: 10,
      y: 20,
      w: 30,
      h: 40,
    });
  });

  it("inflates circle to bounding box", () => {
    expect(boundingBoxOf(mkCircle(50, 60, 5, 8))).toEqual({
      x: 45,
      y: 52,
      w: 10,
      h: 16,
    });
  });

  it("computes freehand min/max", () => {
    expect(
      boundingBoxOf(
        mkPath([
          [10, 20],
          [30, 5],
          [50, 80],
        ])
      )
    ).toEqual({ x: 10, y: 5, w: 40, h: 75 });
  });
});

describe("simplifyPath", () => {
  it("returns the input when 2 or fewer points", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [10, 10],
    ];
    expect(simplifyPath(pts, 0.5)).toEqual(pts);
  });

  it("drops near-collinear midpoints", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [5, 0.1],
      [10, 0],
    ];
    const out = simplifyPath(pts, 1);
    expect(out).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it("keeps points outside epsilon", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [5, 5],
      [10, 0],
    ];
    const out = simplifyPath(pts, 1);
    expect(out).toEqual(pts);
  });

  it("preserves first and last point", () => {
    const pts: Array<[number, number]> = [
      [0, 0],
      [1, 0.01],
      [2, 0.02],
      [3, 0.01],
      [4, 0],
    ];
    const out = simplifyPath(pts, 0.5);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([4, 0]);
  });
});

describe("shapeMinExtent", () => {
  it("returns min(w, h) for rectangle", () => {
    expect(shapeMinExtent(mkRect(0, 0, 3, 8))).toBe(3);
  });

  it("returns min diameter for ellipse", () => {
    expect(shapeMinExtent(mkCircle(50, 50, 2, 7))).toBe(4);
  });
});
