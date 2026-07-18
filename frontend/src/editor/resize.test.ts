import { describe, expect, it } from "vitest";
import { boxCenter, rotatePoint, type Box } from "./geometry";
import {
  handleAnchor,
  resizeBox,
  resizeRotatedBox,
  rotationFromPointer,
  scaleBoxInGroup,
  type HandleKind,
} from "./resize";

const box: Box = { x: 10, y: 10, width: 40, height: 20 };

describe("resizeBox (unrotated)", () => {
  it("se handle resizes freely, nw corner stays fixed", () => {
    const r = resizeBox(box, "se", { x: 70, y: 60 });
    expect(r).toEqual({ x: 10, y: 10, width: 60, height: 50 });
  });

  it("nw handle keeps the se corner fixed", () => {
    const r = resizeBox(box, "nw", { x: 0, y: 0 });
    expect(r).toEqual({ x: 0, y: 0, width: 50, height: 30 });
  });

  it("edge handles only change one axis", () => {
    const e = resizeBox(box, "e", { x: 90, y: 999 });
    expect(e).toEqual({ x: 10, y: 10, width: 80, height: 20 });
    const n = resizeBox(box, "n", { x: 999, y: 0 });
    expect(n).toEqual({ x: 10, y: 0, width: 40, height: 30 });
  });

  it("flips across the fixed edge when the pointer crosses it", () => {
    const r = resizeBox(box, "e", { x: 4, y: 0 });
    // Anchor is the west edge at x=10; pointer at 4 -> box [4, 10].
    expect(r).toEqual({ x: 4, y: 10, width: 6, height: 20 });
  });

  it("enforces a minimum size", () => {
    const r = resizeBox(box, "se", { x: 10, y: 10 });
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it("keepAspect preserves the aspect ratio on corner handles", () => {
    const r = resizeBox(box, "se", { x: 90, y: 20 }, true);
    expect(r.width / r.height).toBeCloseTo(2); // original 40x20
    expect(r.x).toBe(10);
    expect(r.y).toBe(10);
    expect(r.width).toBe(80); // dominant axis wins
  });

  it("keepAspect on edge handles grows the other axis symmetrically", () => {
    const r = resizeBox(box, "e", { x: 90, y: 0 }, true);
    expect(r.width).toBe(80);
    expect(r.height).toBeCloseTo(40);
    // x-center preserved on the non-dragged axis:
    expect(r.y + r.height / 2).toBeCloseTo(box.y + box.height / 2);
  });
});

describe("resizeRotatedBox", () => {
  const angle = Math.PI / 6; // 30 degrees

  function fixedAnchorCanvas(b: Box, a: number, h: HandleKind) {
    const anchor = handleAnchor(h);
    const p = {
      x: b.x + (1 - anchor.x) * b.width,
      y: b.y + (1 - anchor.y) * b.height,
    };
    return rotatePoint(p, a, boxCenter(b));
  }

  it("keeps the opposite corner stationary in canvas space", () => {
    for (const h of ["nw", "ne", "se", "sw"] as HandleKind[]) {
      // Drag each handle a little outward from its current rotated position
      // (small enough that the box does not flip).
      const anchor = handleAnchor(h);
      const start = rotatePoint(
        {
          x: box.x + anchor.x * box.width,
          y: box.y + anchor.y * box.height,
        },
        angle,
        boxCenter(box),
      );
      const pointer = {
        x: start.x + (anchor.x - 0.5) * 12,
        y: start.y + (anchor.y - 0.5) * 12,
      };
      const before = fixedAnchorCanvas(box, angle, h);
      const resized = resizeRotatedBox(box, angle, h, pointer);
      const after = fixedAnchorCanvas(resized, angle, h);
      expect(after.x).toBeCloseTo(before.x, 8);
      expect(after.y).toBeCloseTo(before.y, 8);
    }
  });

  it("matches plain resizeBox when angle is 0", () => {
    const rotated = resizeRotatedBox(box, 0, "se", { x: 70, y: 60 });
    expect(rotated).toEqual(resizeBox(box, "se", { x: 70, y: 60 }));
  });

  it("the dragged corner lands on the pointer (corner handles)", () => {
    const pointer = { x: 82, y: 71 };
    const resized = resizeRotatedBox(box, angle, "se", pointer);
    const dragged = rotatePoint(
      { x: resized.x + resized.width, y: resized.y + resized.height },
      angle,
      boxCenter(resized),
    );
    expect(dragged.x).toBeCloseTo(pointer.x, 8);
    expect(dragged.y).toBeCloseTo(pointer.y, 8);
  });
});

describe("scaleBoxInGroup", () => {
  const from: Box = { x: 0, y: 0, width: 100, height: 50 };
  const to: Box = { x: 10, y: 10, width: 200, height: 100 };

  it("scales positions and sizes proportionally", () => {
    const r = scaleBoxInGroup({ x: 25, y: 10, width: 50, height: 20 }, from, to);
    expect(r).toEqual({ x: 60, y: 30, width: 100, height: 40 });
  });

  it("keeps elements at the group edges on the edges", () => {
    const r = scaleBoxInGroup({ x: 0, y: 0, width: 100, height: 50 }, from, to);
    expect(r).toEqual(to);
  });
});

describe("rotationFromPointer", () => {
  const center = { x: 0, y: 0 };

  it("is 0 when the pointer is straight above (handle rest position)", () => {
    expect(rotationFromPointer(center, { x: 0, y: -10 })).toBeCloseTo(0);
  });

  it("is 90deg when the pointer is to the right", () => {
    expect(rotationFromPointer(center, { x: 10, y: 0 })).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("snaps to 15-degree steps when requested", () => {
    const a = rotationFromPointer(center, { x: 10, y: -9.7 }, true);
    const deg = (a * 180) / Math.PI;
    expect(deg % 15).toBeCloseTo(0);
  });
});
