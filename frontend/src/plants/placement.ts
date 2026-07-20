/**
 * Placement helpers for plant tools (single stamp vs spray for mats).
 */
import type { Archetype, PlantElement } from "../document/schema";

/** Groundcovers are sprayed as a mat; everything else is a single stamp. */
export function speciesUsesSpray(archetype: Archetype): boolean {
  return archetype === "groundcover";
}

/** Footprint size for a single stamp (canvas units). */
export function plantStampSize(archetype: Archetype): number {
  switch (archetype) {
    case "tree":
      return 72;
    case "shrub":
      return 56;
    case "grass":
      return 48;
    case "flower":
      return 40;
    case "succulent":
      return 36;
    case "groundcover":
      return 32;
    case "vine":
      return 44;
    default:
      return 56;
  }
}

/** Minimum center-to-center distance while spraying (canvas units). */
export function spraySpacing(archetype: Archetype, stampSize: number): number {
  if (archetype === "groundcover") return stampSize * 0.55;
  return stampSize * 0.85;
}

/**
 * Collapse a spray session into one groundcover patch whose box is the
 * union of all pending stamps. Preview still shows individual stamps;
 * commit stores a single element.
 */
export function mergeSprayIntoPatch(
  pending: PlantElement[],
): PlantElement | null {
  if (pending.length === 0) return null;
  const first = pending[0];
  if (pending.length === 1) return first;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of pending) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  // Soft pad so the mat reads as continuous coverage, not a tight AABB.
  const pad = first.width * 0.12;
  return {
    ...first,
    x: minX - pad,
    y: minY - pad,
    width: Math.max(8, maxX - minX + pad * 2),
    height: Math.max(8, maxY - minY + pad * 2),
  };
}

/** Relative scale step for groundcover expand / shrink (context menu). */
export const GROUNDCOVER_SCALE_STEP = 1.18;

/** Scale a box about its center; clamps to a minimum footprint. */
export function scaleElementFromCenter<
  T extends { x: number; y: number; width: number; height: number },
>(el: T, factor: number, minSize = 8): T {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const width = Math.max(minSize, el.width * factor);
  const height = Math.max(minSize, el.height * factor);
  return {
    ...el,
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  };
}

/**
 * CSS cursor for groundcover spray mode (spray-can hotspot near the nozzle).
 * Falls back to `cell` if the data-URI cursor is unsupported.
 */
export const SPRAY_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M9 11h7a2 2 0 012 2v7a2 2 0 01-2 2H9a2 2 0 01-2-2v-7a2 2 0 012-2z" stroke="#222" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M11 11V7.5A1.5 1.5 0 0112.5 6h0A1.5 1.5 0 0114 7.5V11" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M14.5 4.5L16 2.5M16.5 6.5H19M17 3.2l2 .8" stroke="#222" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="12.5" cy="17" r="1.3" fill="#222"/>
  </svg>`,
)}") 8 20, cell`;
