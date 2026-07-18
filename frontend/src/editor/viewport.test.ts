import { describe, expect, it } from "vitest";
import {
  canvasToScreen,
  clampZoom,
  gridStep,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToCanvas,
  zoomAt,
  type Viewport,
} from "./viewport";

const vp: Viewport = { offsetX: 120, offsetY: -40, zoom: 1.6 };

describe("viewport transforms", () => {
  it("canvasToScreen and screenToCanvas are inverses", () => {
    const p = { x: 33.5, y: -71.25 };
    const s = canvasToScreen(vp, p);
    const back = screenToCanvas(vp, s);
    expect(back.x).toBeCloseTo(p.x, 10);
    expect(back.y).toBeCloseTo(p.y, 10);
  });

  it("applies offset and zoom in the right order", () => {
    expect(canvasToScreen(vp, { x: 0, y: 0 })).toEqual({ x: 120, y: -40 });
    expect(canvasToScreen(vp, { x: 10, y: 10 })).toEqual({
      x: 120 + 16,
      y: -40 + 16,
    });
  });

  it("panBy shifts the offset by screen pixels", () => {
    const panned = panBy(vp, 5, -7);
    expect(panned.offsetX).toBe(125);
    expect(panned.offsetY).toBe(-47);
    expect(panned.zoom).toBe(vp.zoom);
  });

  it("zoomAt keeps the anchor's canvas point fixed on screen", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToCanvas(vp, anchor);
    const zoomed = zoomAt(vp, anchor, 2.5);
    const after = screenToCanvas(zoomed, anchor);
    expect(zoomed.zoom).toBe(2.5);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it("zoomAt clamps zoom to the allowed range", () => {
    expect(zoomAt(vp, { x: 0, y: 0 }, 1000).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(vp, { x: 0, y: 0 }, 0.0001).zoom).toBe(MIN_ZOOM);
    expect(clampZoom(3)).toBe(3);
  });

  it("gridStep keeps dot spacing in a sane screen-pixel range", () => {
    for (const zoom of [0.05, 0.1, 0.33, 1, 2.7, 8]) {
      const px = gridStep(zoom) * zoom;
      expect(px).toBeGreaterThanOrEqual(14);
      expect(px).toBeLessThanOrEqual(112);
    }
  });
});
