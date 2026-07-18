/**
 * FROZEN CONTRACT (Wave 1): the backend inference API.
 *
 * Mirrored by Pydantic models in backend/app/models.py. Agent C implements
 * real inference behind these shapes; Agent E builds the photo UX against
 * them (the Wave 1 backend already answers with plausible canned responses,
 * so the UX is fully testable before real inference lands).
 *
 * All coordinates are pixels in the uploaded photo's coordinate system,
 * origin top-left.
 */

export interface PhotoUploadResponse {
  imageId: string;
  width: number;
  height: number;
}

/** SAM-style point prompt. label 1 = foreground, 0 = background. */
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
  /** Max vertices in the simplified polygon (default 64). */
  maxVertices?: number;
}

export interface SegmentedRegion {
  /** Simplified closed polygon, [x, y] pairs, photo pixel coordinates. */
  polygon: [number, number][];
  /** Axis-aligned bounds of the mask. */
  bbox: BoxPrompt;
  /** Mask area in pixels — used to size plant icons to footprint. */
  areaPx: number;
  /** Model confidence 0..1. */
  score: number;
}

export interface SegmentResponse {
  regions: SegmentedRegion[];
}

export interface RectifyRequest {
  /**
   * The 4 photo-pixel corners of a real-world rectangle, in order:
   * top-left, top-right, bottom-right, bottom-left.
   */
  corners: [number, number][];
  /** Real-world size of that rectangle, in the garden's measure unit. */
  realWidth: number;
  realHeight: number;
}

export interface RectifyResponse {
  /** New imageId for the rectified (top-down) photo. */
  imageId: string;
  width: number;
  height: number;
  /** Pixels per real-world unit in the rectified image. */
  pixelsPerUnit: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

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

export async function rectifyPhoto(
  imageId: string,
  req: RectifyRequest,
): Promise<RectifyResponse> {
  return json(
    await fetch(`${BASE}/photos/${imageId}/rectify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }),
  );
}
