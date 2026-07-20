/**
 * Convert layout API regions into wizard surfaces, then into editable canvas
 * elements on Apply (polygons + dimmed crop photo — not a locked GroundLayer).
 */
import {
  newId,
  newSeed,
  type Element,
  type ImageElement,
  type LandscapeMaterial,
  type LandscapeSurface,
  type Point,
  type PolygonElement,
  type ShapeRole,
} from "../document/schema";
import { MATERIAL_STYLES } from "../landscape/styles";
import type { LayoutRegion, LayoutRole } from "./api";
import { extractLayout, layoutFromLabels } from "./api";
import {
  FIT_CANVAS,
  polygonFromPhotoRegion,
  type ImageBox,
  type PhotoSize,
} from "./coords";

const ROLE_TO_MATERIAL: Record<LayoutRole, LandscapeMaterial> = {
  grass: "grass",
  mulch: "mulch",
  hardscape: "hardscape",
};

const MATERIAL_TO_ROLE: Record<LandscapeMaterial, ShapeRole> = {
  grass: "path",
  mulch: "bed",
  hardscape: "hardscape",
};

/** Normalize photo-pixel polygon into 0..1 of the site rectangle. */
export function regionToSurface(
  region: LayoutRegion,
  photo: PhotoSize,
): LandscapeSurface {
  const points: Point[] = region.polygon.map(([px, py]) => ({
    x: Math.min(1, Math.max(0, px / photo.width)),
    y: Math.min(1, Math.max(0, py / photo.height)),
  }));
  return {
    id: newId(),
    material: ROLE_TO_MATERIAL[region.role],
    points,
  };
}

export function fitSiteBox(
  photo: PhotoSize,
  center: Point,
): { x: number; y: number; width: number; height: number } {
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

export async function buildSurfacesFromLayout(
  imageId: string,
  photo: PhotoSize,
): Promise<LandscapeSurface[]> {
  const { regions } = await extractLayout(imageId);
  return regions.map((r) => regionToSurface(r, photo));
}

export async function buildSurfacesFromLabels(
  imageId: string,
  labelPng: Blob,
  photo: PhotoSize,
): Promise<LandscapeSurface[]> {
  const { regions } = await layoutFromLabels(imageId, labelPng);
  return regions.map((r) => regionToSurface(r, photo));
}

/** Surface (0..1 of crop) → editable PolygonElement on the site box. */
export function surfaceToPolygonElement(
  surface: LandscapeSurface,
  photo: PhotoSize,
  siteBox: ImageBox,
  groupId?: string,
): PolygonElement {
  const polygon: [number, number][] = surface.points.map((p) => [
    p.x * photo.width,
    p.y * photo.height,
  ]);
  const { box, points } = polygonFromPhotoRegion(polygon, photo, siteBox);
  const style = MATERIAL_STYLES[surface.material];
  return {
    id: newId(),
    type: "polygon",
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    angle: 0,
    seed: newSeed(),
    opacity: 1,
    locked: false,
    groupId,
    points,
    style: {
      fillColor: style.fillColor,
      strokeColor: style.strokeColor,
      strokeWidth: 2,
    },
    role: MATERIAL_TO_ROLE[surface.material],
  };
}

/** Dimmed crop photo behind imported shapes. */
export function makeCropImageElement(args: {
  box: ImageBox;
  href: string;
  imageId?: string;
  groupId?: string;
}): ImageElement {
  return {
    id: newId(),
    type: "image",
    x: args.box.x,
    y: args.box.y,
    width: args.box.width,
    height: args.box.height,
    angle: 0,
    seed: newSeed(),
    opacity: 1,
    locked: false,
    groupId: args.groupId,
    href: args.href,
    imageId: args.imageId,
    visible: true,
    dimmed: true,
  };
}

/**
 * Build canvas elements for Apply: dimmed photo + material polygons.
 * All share one `groupId` so select/move treats the import as a unit.
 * Caller should insert the returned array at the front of `view.elements`
 * (back of the z-order).
 */
export function surfacesToCanvasElements(args: {
  surfaces: LandscapeSurface[];
  photo: PhotoSize;
  siteBox: ImageBox;
  overlayHref: string;
  overlayImageId?: string;
}): Element[] {
  const groupId = newId();
  const image = makeCropImageElement({
    box: args.siteBox,
    href: args.overlayHref,
    imageId: args.overlayImageId,
    groupId,
  });
  const polys = args.surfaces
    .filter((s) => s.points.length >= 3)
    .map((s) =>
      surfaceToPolygonElement(s, args.photo, args.siteBox, groupId),
    );
  return [image, ...polys];
}
