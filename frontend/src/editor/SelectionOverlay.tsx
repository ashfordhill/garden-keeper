/**
 * Excalidraw-style selection chrome, rendered in SCREEN space so outlines
 * and handles stay a constant pixel size at any zoom. For a single element
 * the outline and handles follow the element's rotation; for a multi-select
 * an axis-aligned group box is shown (group rotate is not offered).
 */
import type { Element, Point } from "../document/schema";
import {
  boxCenter,
  boxOf,
  elementAABB,
  rotatePoint,
  unionBoxes,
  type Box,
} from "./geometry";
import { HANDLES, handleAnchor, handleCursor, type HandleKind } from "./resize";
import { canvasToScreen, type Viewport } from "./viewport";

export const HANDLE_SIZE = 8;
export const ROTATE_HANDLE_OFFSET = 24;

const ACCENT = "#6965db";

export interface SelectionGeometry {
  /** Unrotated box in canvas units (single element or group AABB). */
  box: Box;
  /** Rotation applied to the box (0 for groups). */
  angle: number;
  /** True when exactly one unlocked element is selected. */
  single: boolean;
}

/** Selection geometry for the current selection, or null when empty. */
export function getSelectionGeometry(
  selected: Element[],
): SelectionGeometry | null {
  if (selected.length === 0) return null;
  if (selected.length === 1) {
    const el = selected[0];
    return { box: boxOf(el), angle: el.angle, single: true };
  }
  const union = unionBoxes(
    selected.map((el) => elementAABB(boxOf(el), el.angle)),
  );
  return union ? { box: union, angle: 0, single: false } : null;
}

/** Screen position of a resize handle. */
export function handleScreenPos(
  geo: SelectionGeometry,
  h: HandleKind,
  vp: Viewport,
): Point {
  const a = handleAnchor(h);
  const p = {
    x: geo.box.x + a.x * geo.box.width,
    y: geo.box.y + a.y * geo.box.height,
  };
  return canvasToScreen(vp, rotatePoint(p, geo.angle, boxCenter(geo.box)));
}

/** Screen position of the rotate handle (above the box's top edge). */
export function rotateHandleScreenPos(
  geo: SelectionGeometry,
  vp: Viewport,
): Point {
  const top = {
    x: geo.box.x + geo.box.width / 2,
    y: geo.box.y - ROTATE_HANDLE_OFFSET / vp.zoom,
  };
  return canvasToScreen(vp, rotatePoint(top, geo.angle, boxCenter(geo.box)));
}

export function SelectionOverlay({
  geometry: geo,
  viewport: vp,
  onHandlePointerDown,
  onRotatePointerDown,
}: {
  geometry: SelectionGeometry;
  viewport: Viewport;
  onHandlePointerDown: (h: HandleKind, e: React.PointerEvent) => void;
  onRotatePointerDown: (e: React.PointerEvent) => void;
}) {
  const center = boxCenter(geo.box);
  const corners = [
    { x: geo.box.x, y: geo.box.y },
    { x: geo.box.x + geo.box.width, y: geo.box.y },
    { x: geo.box.x + geo.box.width, y: geo.box.y + geo.box.height },
    { x: geo.box.x, y: geo.box.y + geo.box.height },
  ].map((p) => canvasToScreen(vp, rotatePoint(p, geo.angle, center)));
  const outline = corners.map((p) => `${p.x},${p.y}`).join(" ");
  const rotatePos = geo.single ? rotateHandleScreenPos(geo, vp) : null;
  const topMid = geo.single
    ? canvasToScreen(
        vp,
        rotatePoint(
          { x: geo.box.x + geo.box.width / 2, y: geo.box.y },
          geo.angle,
          center,
        ),
      )
    : null;

  return (
    <g data-testid="selection-overlay">
      <polygon
        points={outline}
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
        pointerEvents="none"
      />
      {rotatePos && topMid && (
        <>
          <line
            x1={topMid.x}
            y1={topMid.y}
            x2={rotatePos.x}
            y2={rotatePos.y}
            stroke={ACCENT}
            strokeWidth={1}
            pointerEvents="none"
          />
          <circle
            cx={rotatePos.x}
            cy={rotatePos.y}
            r={HANDLE_SIZE / 2 + 1}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.5}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onRotatePointerDown(e);
            }}
          />
        </>
      )}
      {HANDLES.map((h) => {
        const p = handleScreenPos(geo, h, vp);
        return (
          <rect
            key={h}
            x={p.x - HANDLE_SIZE / 2}
            y={p.y - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            rx={2}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.5}
            style={{ cursor: handleCursor(h, geo.angle) }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onHandlePointerDown(h, e);
            }}
          />
        );
      })}
    </g>
  );
}
