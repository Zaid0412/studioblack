import { describe, it, expect } from "vitest";
import {
  centroidOf,
  boundingBoxOf,
  simplifyPath,
  shapeMinExtent,
} from "@/lib/shapeUtils";
import type { PinShape } from "@/types";

describe("centroidOf", () => {
  it("returns rectangle center", () => {
    const shape: PinShape = { type: "rectangle", x: 10, y: 20, w: 30, h: 40 };
    expect(centroidOf(shape)).toEqual([25, 40]);
  });

  it("returns circle center", () => {
    const shape: PinShape = { type: "circle", cx: 50, cy: 60, rx: 5, ry: 5 };
    expect(centroidOf(shape)).toEqual([50, 60]);
  });

  it("returns freehand mean", () => {
    const shape: PinShape = {
      type: "freehand",
      points: [
        [0, 0],
        [10, 20],
        [20, 40],
      ],
    };
    expect(centroidOf(shape)).toEqual([10, 20]);
  });

  it("returns [0,0] for empty freehand", () => {
    const shape: PinShape = { type: "freehand", points: [] };
    expect(centroidOf(shape)).toEqual([0, 0]);
  });
});

describe("boundingBoxOf", () => {
  it("returns rectangle as-is", () => {
    const shape: PinShape = { type: "rectangle", x: 10, y: 20, w: 30, h: 40 };
    expect(boundingBoxOf(shape)).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it("inflates circle to bounding box", () => {
    const shape: PinShape = { type: "circle", cx: 50, cy: 60, rx: 5, ry: 8 };
    expect(boundingBoxOf(shape)).toEqual({ x: 45, y: 52, w: 10, h: 16 });
  });

  it("computes freehand min/max", () => {
    const shape: PinShape = {
      type: "freehand",
      points: [
        [10, 20],
        [30, 5],
        [50, 80],
      ],
    };
    expect(boundingBoxOf(shape)).toEqual({ x: 10, y: 5, w: 40, h: 75 });
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
    const shape: PinShape = { type: "rectangle", x: 0, y: 0, w: 3, h: 8 };
    expect(shapeMinExtent(shape)).toBe(3);
  });

  it("returns min diameter for ellipse", () => {
    const shape: PinShape = { type: "circle", cx: 50, cy: 50, rx: 2, ry: 7 };
    expect(shapeMinExtent(shape)).toBe(4);
  });
});
