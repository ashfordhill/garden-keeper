/**
 * Visual styles for ground materials. Season-aware grass (and friends) can
 * grow here later as `Record<SeasonPhase, …>` without changing the GroundLayer
 * schema — surfaces only store `material`, not colors.
 */
import type { LandscapeMaterial, SeasonPhase } from "../document/schema";

export interface MaterialStyle {
  fillColor: string;
  strokeColor: string;
  label: string;
}

/** Default (display / peak-season) look on the plan canvas. */
export const MATERIAL_STYLES: Record<LandscapeMaterial, MaterialStyle> = {
  grass: {
    label: "Grass",
    fillColor: "#5a9e5ecc",
    strokeColor: "#2e6b34",
  },
  mulch: {
    label: "Mulch",
    fillColor: "#6b4a35cc",
    strokeColor: "#3e2723",
  },
  hardscape: {
    label: "Stone / concrete",
    fillColor: "#9aa3a8cc",
    strokeColor: "#546e7a",
  },
};

/**
 * Future hook: resolve grass (etc.) appearance for a season. Today returns
 * the default style for every phase; swap in fall browns / winter tans later.
 */
export function resolveMaterialStyle(
  material: LandscapeMaterial,
  _phase: SeasonPhase | null,
): MaterialStyle {
  return MATERIAL_STYLES[material];
}

/**
 * Label-mask encoding for the backend (/layout/from-labels):
 *   R-dominant → grass
 *   G-dominant → mulch
 *   B-dominant → hardscape
 *
 * These MUST stay channel-pure — do not use "pretty" garden greens/browns here
 * or the decoder will swap materials.
 */
export const LABEL_COLORS: Record<LandscapeMaterial, string> = {
  grass: "#e53935",
  mulch: "#43a047",
  hardscape: "#1e88e5",
};

/** Friendly swatch colors in the wizard toolbar (not sent to the backend). */
export const SWATCH_COLORS: Record<LandscapeMaterial, string> = {
  grass: "#4caf50",
  mulch: "#6d4c41",
  hardscape: "#90a4ae",
};
