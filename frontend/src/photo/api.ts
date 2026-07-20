/**
 * Backend inference / layout API client.
 * Coordinates are pixels in the photo, origin top-left.
 */

export interface PhotoUploadResponse {
  imageId: string;
  width: number;
  height: number;
}

export interface PointPrompt {
  x: number;
  y: number;
  label: 0 | 1;
}

export interface BoxPrompt {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SegmentRequest {
  points?: PointPrompt[];
  box?: BoxPrompt;
  maxVertices?: number;
}

export interface SegmentedRegion {
  polygon: [number, number][];
  bbox: BoxPrompt;
  areaPx: number;
  score: number;
}

export interface SegmentResponse {
  regions: SegmentedRegion[];
}

/** Four corners define an axis-aligned crop (no perspective warp). */
export interface RectifyRequest {
  corners: [number, number][];
  /** @deprecated Ignored — kept for older clients. */
  realWidth?: number;
  /** @deprecated Ignored — kept for older clients. */
  realHeight?: number;
}

export interface RectifyResponse {
  imageId: string;
  width: number;
  height: number;
  /** Placeholder; no real-world calibration from crop. */
  pixelsPerUnit: number;
}

export type LayoutRole = "grass" | "mulch" | "hardscape";

export interface LayoutRegion {
  role: LayoutRole;
  polygon: [number, number][];
  bbox: BoxPrompt;
  areaPx: number;
  score: number;
}

export interface LayoutResponse {
  regions: LayoutRegion[];
}

const BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`${res.url}: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadPhoto(file: Blob): Promise<PhotoUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return json(await fetch(`${BASE}/photos`, { method: "POST", body: form }));
}

export function photoUrl(imageId: string): string {
  return `${BASE}/photos/${imageId}/image`;
}

export async function segmentPhoto(
  imageId: string,
  req: SegmentRequest,
): Promise<SegmentResponse> {
  return json(
    await fetch(`${BASE}/photos/${imageId}/segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  );
}

/** Crop the axis-aligned bbox of four corners (no warp). */
export async function rectifyPhoto(
  imageId: string,
  req: RectifyRequest,
): Promise<RectifyResponse> {
  return json(
    await fetch(`${BASE}/photos/${imageId}/rectify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corners: req.corners }),
    }),
  );
}

export async function extractLayout(
  imageId: string,
  maxVertices = 48,
): Promise<LayoutResponse> {
  return json(
    await fetch(`${BASE}/photos/${imageId}/layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxVertices }),
    }),
  );
}

/** User-painted RGB label mask → grass/mulch/hardscape polygons. */
export async function layoutFromLabels(
  imageId: string,
  labelPng: Blob,
): Promise<LayoutResponse> {
  const form = new FormData();
  form.append("file", labelPng, "labels.png");
  return json(
    await fetch(`${BASE}/photos/${imageId}/layout/from-labels`, {
      method: "POST",
      body: form,
    }),
  );
}
