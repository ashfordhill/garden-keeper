/**
 * Pure 2D geometry helpers shared by hit-testing, marquee selection and the
 * transform handles. Angles are radians, rotation is around a box's center
 * (matching the element model in document/schema.ts).
 */
import type { Point } from "../document/schema";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boxOf(el: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Box {
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function boxCenter(b: Box): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export function rotatePoint(p: Point, angle: number, center: Point): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/** Corners of a box after rotating it around its center: nw, ne, se, sw. */
export function rotatedBoxCorners(
  b: Box,
  angle: number,
): [Point, Point, Point, Point] {
  const c = boxCenter(b);
  return [
    rotatePoint({ x: b.x, y: b.y }, angle, c),
    rotatePoint({ x: b.x + b.width, y: b.y }, angle, c),
    rotatePoint({ x: b.x + b.width, y: b.y + b.height }, angle, c),
    rotatePoint({ x: b.x, y: b.y + b.height }, angle, c),
  ];
}

/** Axis-aligned bounding box of a rotated box. */
export function elementAABB(b: Box, angle: number): Box {
  if (angle === 0) return b;
  const corners = rotatedBoxCorners(b, angle);
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

export function pointInBox(p: Point, b: Box): boolean {
  return (
    p.x >= b.x &&
    p.x <= b.x + b.width &&
    p.y >= b.y &&
    p.y <= b.y + b.height
  );
}

export function pointInRotatedBox(p: Point, b: Box, angle: number): boolean {
  if (angle === 0) return pointInBox(p, b);
  return pointInBox(rotatePoint(p, -angle, boxCenter(b)), b);
}

/** Normalized (positive width/height) box spanning two arbitrary corners. */
export function boxFromPoints(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function unionBoxes(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Bounding box of a list of points, with a minimum size to avoid zero dims. */
export function boundsOfPoints(points: Point[], minSize = 1): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(minSize, maxX - minX),
    height: Math.max(minSize, maxY - minY),
  };
}

/** Normalize absolute points into 0..1 coordinates relative to `box`. */
export function normalizePoints(points: Point[], box: Box): Point[] {
  return points.map((p) => ({
    x: (p.x - box.x) / box.width,
    y: (p.y - box.y) / box.height,
  }));
}
