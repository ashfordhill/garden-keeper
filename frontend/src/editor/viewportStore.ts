/**
 * Ephemeral viewport state (pan/zoom). Deliberately separate from the
 * document store: the viewport is never persisted or undoable. Lives in a
 * tiny Zustand store (rather than component state) only so the Toolbar can
 * show the zoom level and reset it.
 */
import { create } from "zustand";
import {
  DEFAULT_VIEWPORT,
  clampZoom,
  panBy,
  zoomAt,
  type Viewport,
} from "./viewport";
import type { Point } from "../document/schema";

interface ViewportState {
  viewport: Viewport;
  setViewport: (vp: Viewport) => void;
  panViewportBy: (dx: number, dy: number) => void;
  zoomViewportAt: (screenAnchor: Point, nextZoom: number) => void;
  /** Reset zoom to 100%, keeping the given screen point stationary. */
  resetZoom: (screenAnchor?: Point) => void;
}

export const useViewportStore = create<ViewportState>((set) => ({
  viewport: DEFAULT_VIEWPORT,
  setViewport: (vp) => set({ viewport: { ...vp, zoom: clampZoom(vp.zoom) } }),
  panViewportBy: (dx, dy) =>
    set((s) => ({ viewport: panBy(s.viewport, dx, dy) })),
  zoomViewportAt: (screenAnchor, nextZoom) =>
    set((s) => ({ viewport: zoomAt(s.viewport, screenAnchor, nextZoom) })),
  resetZoom: (screenAnchor) =>
    set((s) => ({
      viewport: zoomAt(
        s.viewport,
        screenAnchor ?? {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        },
        1,
      ),
    })),
}));
