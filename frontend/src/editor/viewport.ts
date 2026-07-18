/**
 * Viewport math for the infinite canvas. The viewport is ephemeral editor
 * state (never stored in the document): a pan offset in screen pixels plus a
 * zoom factor. canvas -> screen: s = c * zoom + offset.
 */
import type { Point } from "../document/schema";

export interface Viewport {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export const DEFAULT_VIEWPORT: Viewport = { offsetX: 0, offsetY: 0, zoom: 1 };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function canvasToScreen(vp: Viewport, p: Point): Point {
  return { x: p.x * vp.zoom + vp.offsetX, y: p.y * vp.zoom + vp.offsetY };
}

export function screenToCanvas(vp: Viewport, p: Point): Point {
  return { x: (p.x - vp.offsetX) / vp.zoom, y: (p.y - vp.offsetY) / vp.zoom };
}

/** Pan by a screen-pixel delta. */
export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, offsetX: vp.offsetX + dx, offsetY: vp.offsetY + dy };
}

/**
 * Set zoom while keeping the canvas point under `screenAnchor` stationary
 * on screen (zoom-to-cursor).
 */
export function zoomAt(
  vp: Viewport,
  screenAnchor: Point,
  nextZoom: number,
): Viewport {
  const zoom = clampZoom(nextZoom);
  const anchor = screenToCanvas(vp, screenAnchor);
  return {
    zoom,
    offsetX: screenAnchor.x - anchor.x * zoom,
    offsetY: screenAnchor.y - anchor.y * zoom,
  };
}

/**
 * Dot-grid spacing in canvas units for a given zoom: powers-of-two multiples
 * of the base step so dots stay comfortably spaced on screen at any zoom.
 */
export function gridStep(zoom: number, base = 20): number {
  let step = base;
  while (step * zoom < 14) step *= 2;
  while (step * zoom > 56 && step > base / 8) step /= 2;
  return step;
}
