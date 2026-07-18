/**
 * Cheap deterministic "hand-drawn" SVG path generators. Each shape is drawn
 * as a sequence of slightly-bowed quadratic segments whose jitter comes from
 * a small seeded RNG, so a given (element, seed) always wobbles identically.
 * Amplitude is kept proportional to (but capped by) the shape size so the
 * effect stays subtle at any scale.
 */
import type { Point } from "../document/schema";

/** mulberry32 — tiny fast seeded PRNG, returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitterAmp(size: number): number {
  // ~1.25 canvas units on typical shapes, fading out on tiny ones.
  return Math.min(1.25, size * 0.04);
}

/**
 * One hand-drawn segment from a to b: a quadratic bezier whose control point
 * is offset perpendicular to the segment, with jittered endpoints. Long
 * segments are split so the wobble reads as a wavering line, not one arc.
 */
function roughSegment(
  a: Point,
  b: Point,
  rng: () => number,
  amp: number,
): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const pieces = len > 90 ? 2 : 1;
  let d = "";
  let prev = a;
  for (let i = 1; i <= pieces; i++) {
    const t = i / pieces;
    const end =
      i === pieces
        ? b
        : {
            x: a.x + (b.x - a.x) * t + (rng() - 0.5) * amp,
            y: a.y + (b.y - a.y) * t + (rng() - 0.5) * amp,
          };
    const mid = { x: (prev.x + end.x) / 2, y: (prev.y + end.y) / 2 };
    // Perpendicular offset for the bow.
    const nx = -(end.y - prev.y) / (len / pieces || 1);
    const ny = (end.x - prev.x) / (len / pieces || 1);
    const bow = (rng() - 0.5) * 2 * amp * Math.min(1, len / 40);
    d += ` Q ${(mid.x + nx * bow).toFixed(2)} ${(mid.y + ny * bow).toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    prev = end;
  }
  return d;
}

function roughPolyline(
  points: Point[],
  seed: number,
  size: number,
  closed: boolean,
): string {
  if (points.length < 2) return "";
  const rng = createRng(seed);
  const amp = jitterAmp(size);
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += roughSegment(points[i - 1], points[i], rng, amp);
  }
  if (closed) {
    d += roughSegment(points[points.length - 1], points[0], rng, amp);
    d += " Z";
  }
  return d;
}

/** Hand-drawn rectangle path for a box anchored at (x, y). */
export function roughRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
): string {
  const size = Math.min(width, height);
  return roughPolyline(
    [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    seed,
    size,
    true,
  );
}

/** Hand-drawn ellipse centered at (cx, cy). */
export function roughEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
): string {
  const rng = createRng(seed);
  const amp = jitterAmp(Math.min(rx, ry));
  const steps = 16;
  const start = rng() * Math.PI * 2;
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = start + (i / steps) * Math.PI * 2;
    const j = 1 + ((rng() - 0.5) * 2 * amp) / Math.max(rx, ry, 1);
    pts.push({ x: cx + Math.cos(t) * rx * j, y: cy + Math.sin(t) * ry * j });
  }
  // Smooth closed curve through midpoints.
  let d = `M ${((pts[0].x + pts[steps - 1].x) / 2).toFixed(2)} ${((pts[0].y + pts[steps - 1].y) / 2).toFixed(2)}`;
  for (let i = 0; i < steps; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % steps];
    d += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${((p.x + next.x) / 2).toFixed(2)} ${((p.y + next.y) / 2).toFixed(2)}`;
  }
  return d + " Z";
}

/** Hand-drawn closed polygon from absolute points. */
export function roughPolygonPath(
  points: Point[],
  seed: number,
  size: number,
): string {
  return roughPolyline(points, seed, size, true);
}

/** Smoothed open stroke through absolute points (freehand). */
export function smoothOpenPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const next = points[i + 1];
    d += ` Q ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${((p.x + next.x) / 2).toFixed(2)} ${((p.y + next.y) / 2).toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}
