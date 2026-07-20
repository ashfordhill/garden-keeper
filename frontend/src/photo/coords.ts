/**
 * Photo-pixel ↔ canvas coordinate conversion.
 *
 * Convention: an ImageElement is axis-aligned (angle 0). Photo pixels map
 * linearly onto its canvas box:
 *   canvasX = image.x + (px / photoWidth) * image.width
 *   canvasY = image.y + (py / photoHeight) * image.height
 *
 * After calibration, we set view.scale so that:
 *   unitsPerCanvasUnit = realUnit / canvasUnit
 * i.e. one canvas unit equals that many real-world units (ft or m).
 * The rectified image is sized so its long edge is FIT_CANVAS units, and
 * pixelsPerUnit from the backend tells us real size → canvas scale.
 */
import type { BoxPrompt } from "./api";
import type { Point, ShapeRole } from "../document/schema";

export const FIT_CANVAS = 800;

export interface ImageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoSize {
  width: number;
  height: number;
}

/** Size an image to fit FIT_CANVAS on the long edge, preserving aspect. */
export function fitImageBox(
  photo: PhotoSize,
  center: Point,
): { width: number; height: number; x: number; y: number } {
  const scale =
    photo.width >= photo.height
      ? FIT_CANVAS / photo.width
      : FIT_CANVAS / photo.height;
  const width = photo.width * scale;
  const height = photo.height * scale;
  return {
    width,
    height,
    x: center.x - width / 2,
    y: center.y - height / 2,
  };
}

export function photoToCanvas(
  px: number,
  py: number,
  photo: PhotoSize,
  image: ImageBox,
): Point {
  return {
    x: image.x + (px / photo.width) * image.width,
    y: image.y + (py / photo.height) * image.height,
  };
}

export function canvasToPhoto(
  canvas: Point,
  photo: PhotoSize,
  image: ImageBox,
): Point {
  return {
    x: ((canvas.x - image.x) / image.width) * photo.width,
    y: ((canvas.y - image.y) / image.height) * photo.height,
  };
}

/** Convert a photo-pixel polygon into a PolygonElement-ready box + normalized points. */
export function polygonFromPhotoRegion(
  polygon: [number, number][],
  photo: PhotoSize,
  image: ImageBox,
): { box: ImageBox; points: Point[] } {
  const canvasPts = polygon.map(([px, py]) =>
    photoToCanvas(px, py, photo, image),
  );
  const xs = canvasPts.map((p) => p.x);
  const ys = canvasPts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const points = canvasPts.map((p) => ({
    x: (p.x - minX) / width,
    y: (p.y - minY) / height,
  }));
  return { box: { x: minX, y: minY, width, height }, points };
}

/** Plant footprint from a photo bbox. */
export function plantBoxFromPhotoBbox(
  bbox: BoxPrompt,
  photo: PhotoSize,
  image: ImageBox,
): ImageBox {
  const tl = photoToCanvas(bbox.x1, bbox.y1, photo, image);
  const br = photoToCanvas(bbox.x2, bbox.y2, photo, image);
  return {
    x: Math.min(tl.x, br.x),
    y: Math.min(tl.y, br.y),
    width: Math.max(Math.abs(br.x - tl.x), 8),
    height: Math.max(Math.abs(br.y - tl.y), 8),
  };
}

/**
 * After rectify: backend returns pixelsPerUnit (px per real unit).
 * We place the rectified image with fitImageBox, so:
 *   canvasUnitsPerRealUnit = fitScale * pixelsPerUnit? Wait —
 *   fitScale = FIT / max(w,h)  (canvas units per photo pixel)
 *   real units across image = photoWidth / pixelsPerUnit
 *   canvas width = photoWidth * fitScale
 *   => unitsPerCanvasUnit = realWidth / canvasWidth
 *                         = (photoWidth / pixelsPerUnit) / (photoWidth * fitScale)
 *                         = 1 / (pixelsPerUnit * fitScale)
 */
export function unitsPerCanvasFromRectify(
  photo: PhotoSize,
  pixelsPerUnit: number,
): number {
  const fitScale =
    photo.width >= photo.height
      ? FIT_CANVAS / photo.width
      : FIT_CANVAS / photo.height;
  return 1 / (pixelsPerUnit * fitScale);
}

export const ROLE_STYLES: Record<
  ShapeRole,
  { fillColor: string; strokeColor: string }
> = {
  generic: { fillColor: "#e8e8e820", strokeColor: "#1e1e1e" },
  bed: { fillColor: "#5d403780", strokeColor: "#3e2723" },
  border: { fillColor: "transparent", strokeColor: "#8d6e63" },
  path: { fillColor: "#66bb6a55", strokeColor: "#2e7d32" },
  hardscape: { fillColor: "#90a4ae55", strokeColor: "#455a64" },
  water: { fillColor: "#64b5f640", strokeColor: "#1565c0" },
};
