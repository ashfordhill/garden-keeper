import { describe, expect, it } from "vitest";
import {
  boundsOfPoints,
  boxFromPoints,
  boxesIntersect,
  elementAABB,
  normalizePoints,
  pointInRotatedBox,
  rotatePoint,
  unionBoxes,
} from "./geometry";

describe("rotatePoint", () => {
  it("rotates 90 degrees around a center", () => {
    const p = rotatePoint({ x: 2, y: 1 }, Math.PI / 2, { x: 1, y: 1 });
    expect(p.x).toBeCloseTo(1);
    expect(p.y).toBeCloseTo(2);
  });
});

describe("elementAABB", () => {
  it("returns the box unchanged when angle is 0", () => {
    const b = { x: 1, y: 2, width: 3, height: 4 };
    expect(elementAABB(b, 0)).toEqual(b);
  });

  it("expands to the rotated extents (45 degrees)", () => {
    // 10x10 box centered at (5,5) rotated 45deg -> AABB of side 10*sqrt(2).
    const aabb = elementAABB(
      { x: 0, y: 0, width: 10, height: 10 },
      Math.PI / 4,
    );
    const side = 10 * Math.SQRT2;
    expect(aabb.width).toBeCloseTo(side);
    expect(aabb.height).toBeCloseTo(side);
    expect(aabb.x).toBeCloseTo(5 - side / 2);
    expect(aabb.y).toBeCloseTo(5 - side / 2);
  });
});

describe("marquee intersection", () => {
  const marquee = { x: 0, y: 0, width: 50, height: 50 };

  it("detects overlap and containment", () => {
    expect(
      boxesIntersect(marquee, { x: 40, y: 40, width: 30, height: 30 }),
    ).toBe(true);
    expect(
      boxesIntersect(marquee, { x: 10, y: 10, width: 5, height: 5 }),
    ).toBe(true);
  });

  it("rejects disjoint boxes", () => {
    expect(
      boxesIntersect(marquee, { x: 51, y: 0, width: 10, height: 10 }),
    ).toBe(false);
    expect(
      boxesIntersect(marquee, { x: 0, y: -20, width: 10, height: 10 }),
    ).toBe(false);
  });

  it("catches rotated elements via their AABB", () => {
    // Tall thin slab just right of the marquee: misses when unrotated, but
    // rotated 45deg its AABB spans back over the marquee.
    const box = { x: 55, y: -20, width: 4, height: 100 };
    expect(boxesIntersect(marquee, elementAABB(box, 0))).toBe(false);
    expect(boxesIntersect(marquee, elementAABB(box, Math.PI / 4))).toBe(true);
  });
});

describe("pointInRotatedBox", () => {
  const box = { x: 0, y: 0, width: 20, height: 4 };

  it("uses the rotated shape, not the AABB", () => {
    // Corner of the AABB is not inside the rotated slab.
    expect(pointInRotatedBox({ x: 18, y: 1 }, box, 0)).toBe(true);
    expect(pointInRotatedBox({ x: 18, y: 1 }, box, Math.PI / 2)).toBe(false);
    // Center is always inside.
    expect(pointInRotatedBox({ x: 10, y: 2 }, box, 1.234)).toBe(true);
  });
});

describe("point/box helpers", () => {
  it("boxFromPoints normalizes negative drags", () => {
    expect(boxFromPoints({ x: 10, y: 10 }, { x: 2, y: 4 })).toEqual({
      x: 2,
      y: 4,
      width: 8,
      height: 6,
    });
  });

  it("unionBoxes bounds all boxes", () => {
    expect(
      unionBoxes([
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: -5, width: 5, height: 5 },
      ]),
    ).toEqual({ x: 0, y: -5, width: 25, height: 15 });
    expect(unionBoxes([])).toBeNull();
  });

  it("boundsOfPoints + normalizePoints round-trip to 0..1", () => {
    const pts = [
      { x: 10, y: 20 },
      { x: 30, y: 60 },
      { x: 20, y: 40 },
    ];
    const box = boundsOfPoints(pts);
    expect(box).toEqual({ x: 10, y: 20, width: 20, height: 40 });
    const norm = normalizePoints(pts, box);
    expect(norm[0]).toEqual({ x: 0, y: 0 });
    expect(norm[1]).toEqual({ x: 1, y: 1 });
    expect(norm[2]).toEqual({ x: 0.5, y: 0.5 });
  });

  it("boundsOfPoints enforces a minimum size for degenerate input", () => {
    const box = boundsOfPoints([
      { x: 5, y: 5 },
      { x: 5, y: 25 },
    ]);
    expect(box.width).toBe(1); // horizontal line still gets a width
    expect(box.height).toBe(20);
  });
});
