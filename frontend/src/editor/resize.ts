/**
 * Resize math for the transform handles, Excalidraw-style.
 *
 * Single-element resize is rotation-aware: the pointer is mapped into the
 * element's unrotated frame, the box is resized against the fixed opposite
 * corner/edge, and the new center is solved so that the fixed point stays
 * stationary in canvas space.
 *
 * Group resize scales every element's (unrotated) box inside the group's
 * axis-aligned bounding box; angles are preserved.
 */
import type { Point } from "../document/schema";
import { boxCenter, rotatePoint, type Box } from "./geometry";

export type HandleKind = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const HANDLES: HandleKind[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

/** Position of a handle on the unrotated box, in 0..1 box coordinates. */
export function handleAnchor(h: HandleKind): Point {
  const x = h.includes("w") ? 0 : h.includes("e") ? 1 : 0.5;
  const y = h.includes("n") ? 0 : h.includes("s") ? 1 : 0.5;
  return { x, y };
}

const MIN_SIZE = 1;

export interface ResizeResult {
  box: Box;
  /** True when the pointer crossed the fixed anchor on that axis. */
  flippedX: boolean;
  flippedY: boolean;
}

/**
 * Resize an unrotated box by dragging handle `h` to `pointer`. The opposite
 * corner/edge stays fixed (the box flips across it when the pointer crosses).
 * With `keepAspect` the original aspect ratio is preserved: dominant axis
 * wins for corner handles; edge handles grow the other axis symmetrically.
 */
export function resizeBoxEx(
  box: Box,
  h: HandleKind,
  pointer: Point,
  keepAspect = false,
): ResizeResult {
  const west = h.includes("w");
  const east = h.includes("e");
  const north = h.includes("n");
  const south = h.includes("s");
  const horizontal = west || east;
  const vertical = north || south;

  // Fixed anchor coordinates (opposite side; unused axis anchors at center).
  const fx = west ? box.x + box.width : box.x;
  const fy = north ? box.y + box.height : box.y;

  // Signed sizes measured from the anchor; negative = flipped.
  let width = horizontal
    ? west
      ? fx - pointer.x
      : pointer.x - fx
    : box.width;
  let height = vertical
    ? north
      ? fy - pointer.y
      : pointer.y - fy
    : box.height;

  if (keepAspect && box.width > 0 && box.height > 0) {
    const aspect = box.width / box.height;
    if (horizontal && vertical) {
      if (Math.abs(width) / aspect > Math.abs(height)) {
        height = (Math.abs(width) / aspect) * Math.sign(height || 1);
      } else {
        width = Math.abs(height) * aspect * Math.sign(width || 1);
      }
    } else if (horizontal) {
      height = Math.abs(width) / aspect;
    } else {
      width = Math.abs(height) * aspect;
    }
  }

  const flippedX = horizontal && width < 0;
  const flippedY = vertical && height < 0;
  const nw = Math.max(MIN_SIZE, Math.abs(width));
  const nh = Math.max(MIN_SIZE, Math.abs(height));

  let nx: number;
  if (horizontal) {
    // Box sits on the pointer's side of the anchor.
    nx = west ? (flippedX ? fx : fx - nw) : flippedX ? fx - nw : fx;
  } else if (keepAspect) {
    nx = box.x + box.width / 2 - nw / 2;
  } else {
    nx = box.x;
  }

  let ny: number;
  if (vertical) {
    ny = north ? (flippedY ? fy : fy - nh) : flippedY ? fy - nh : fy;
  } else if (keepAspect) {
    ny = box.y + box.height / 2 - nh / 2;
  } else {
    ny = box.y;
  }

  return { box: { x: nx, y: ny, width: nw, height: nh }, flippedX, flippedY };
}

export function resizeBox(
  box: Box,
  h: HandleKind,
  pointer: Point,
  keepAspect = false,
): Box {
  return resizeBoxEx(box, h, pointer, keepAspect).box;
}

/**
 * Rotation-aware single-element resize. `pointer` is in canvas coordinates.
 * Returns the element's new unrotated box; `angle` is unchanged.
 */
export function resizeRotatedBox(
  box: Box,
  angle: number,
  h: HandleKind,
  pointer: Point,
  keepAspect = false,
): Box {
  const center = boxCenter(box);
  // Pointer in the element's unrotated frame (pivot: current center).
  const local = rotatePoint(pointer, -angle, center);
  const { box: resized, flippedX, flippedY } = resizeBoxEx(
    box,
    h,
    local,
    keepAspect,
  );

  // The point that must not move: the anchor opposite the dragged handle.
  const a = handleAnchor(h);
  const fixedLocal = {
    x: box.x + (1 - a.x) * box.width,
    y: box.y + (1 - a.y) * box.height,
  };
  const fixedCanvas = rotatePoint(fixedLocal, angle, center);

  // Same anchor on the resized box (mirrored on flipped axes).
  const ax = flippedX ? a.x : 1 - a.x;
  const ay = flippedY ? a.y : 1 - a.y;
  const fixedOnResized = {
    x: resized.x + ax * resized.width,
    y: resized.y + ay * resized.height,
  };
  const newCenterLocal = boxCenter(resized);
  // Solve: fixedCanvas = newCenter + R(angle) * (fixedOnResized - newCenterLocal)
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = fixedOnResized.x - newCenterLocal.x;
  const ry = fixedOnResized.y - newCenterLocal.y;
  const newCenter = {
    x: fixedCanvas.x - (rx * cos - ry * sin),
    y: fixedCanvas.y - (rx * sin + ry * cos),
  };
  return {
    x: newCenter.x - resized.width / 2,
    y: newCenter.y - resized.height / 2,
    width: resized.width,
    height: resized.height,
  };
}

/**
 * Map an element box through a group resize: the group's AABB went from
 * `from` to `to`; scale positions and sizes proportionally.
 */
export function scaleBoxInGroup(box: Box, from: Box, to: Box): Box {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  return {
    x: to.x + (box.x - from.x) * sx,
    y: to.y + (box.y - from.y) * sy,
    width: Math.max(MIN_SIZE, box.width * sx),
    height: Math.max(MIN_SIZE, box.height * sy),
  };
}

/**
 * Angle (radians) for the rotate handle: pointer relative to the box center,
 * with 0 = handle straight up (its rest position). Optionally snapped to 15°.
 */
export function rotationFromPointer(
  center: Point,
  pointer: Point,
  snap = false,
): number {
  let angle =
    Math.atan2(pointer.y - center.y, pointer.x - center.x) + Math.PI / 2;
  if (snap) {
    const step = Math.PI / 12;
    angle = Math.round(angle / step) * step;
  }
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle <= -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/** Cursor for a resize handle, adjusted for element rotation. */
export function handleCursor(h: HandleKind, angle: number): string {
  const dirs = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
  const base = dirs.indexOf(h as (typeof dirs)[number]);
  const step = Math.round(angle / (Math.PI / 4));
  const idx = ((base + step) % 8 + 8) % 8;
  const cursors = [
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
    "ns-resize",
    "nesw-resize",
    "ew-resize",
    "nwse-resize",
  ];
  return cursors[idx];
}
