/**
 * Landscape drawing tools: material presets + stone variants for the editor.
 * Import wizard keeps its own grass/mulch/hardscape brushes — these are for
 * freehand polygon drawing on the plan canvas.
 */
import type { ShapeRole, ShapeStyle } from "../document/schema";

/** Toolbar / hotkey landscape draw tools (polygon interaction). */
export type LandscapeDrawTool =
  | "stonePath"
  | "grassPath"
  | "mulchBed"
  | "hardscape";

export type StoneVariant = "concrete" | "brick" | "gravel" | "flagstone";

export const STONE_VARIANTS: {
  id: StoneVariant;
  label: string;
  fillColor: string;
  strokeColor: string;
}[] = [
  {
    id: "concrete",
    label: "Concrete",
    fillColor: "#9aa3a8cc",
    strokeColor: "#546e7a",
  },
  {
    id: "brick",
    label: "Brick",
    fillColor: "#b56a52cc",
    strokeColor: "#6d2f24",
  },
  {
    id: "gravel",
    label: "Gravel",
    fillColor: "#b0a898cc",
    strokeColor: "#6d6558",
  },
  {
    id: "flagstone",
    label: "Flagstone",
    fillColor: "#8a8580cc",
    strokeColor: "#4a4540",
  },
];

const STONE_BY_ID = new Map(STONE_VARIANTS.map((v) => [v.id, v]));

const GRASS_STYLE = {
  fillColor: "#5a9e5ecc",
  strokeColor: "#2e6b34",
  strokeWidth: 2,
} satisfies ShapeStyle;

const MULCH_STYLE = {
  fillColor: "#6b4a35cc",
  strokeColor: "#3e2723",
  strokeWidth: 2,
} satisfies ShapeStyle;

export function isLandscapeDrawTool(tool: string): tool is LandscapeDrawTool {
  return (
    tool === "stonePath" ||
    tool === "grassPath" ||
    tool === "mulchBed" ||
    tool === "hardscape"
  );
}

/** Stone path + hardscape share the variant wheel. */
export function toolUsesStoneVariants(tool: string): boolean {
  return tool === "stonePath" || tool === "hardscape";
}

export function resolveDrawAppearance(
  tool: LandscapeDrawTool,
  stoneVariant: StoneVariant,
): { role: ShapeRole; style: ShapeStyle; label: string } {
  switch (tool) {
    case "stonePath": {
      const v = STONE_BY_ID.get(stoneVariant) ?? STONE_VARIANTS[0];
      return {
        role: "path",
        label: `${v.label} path`,
        style: {
          fillColor: v.fillColor,
          strokeColor: v.strokeColor,
          strokeWidth: 2,
        },
      };
    }
    case "hardscape": {
      const v = STONE_BY_ID.get(stoneVariant) ?? STONE_VARIANTS[0];
      return {
        role: "hardscape",
        label: v.label,
        style: {
          fillColor: v.fillColor,
          strokeColor: v.strokeColor,
          strokeWidth: 2,
        },
      };
    }
    case "grassPath":
      return { role: "path", label: "Grass path", style: { ...GRASS_STYLE } };
    case "mulchBed":
      return { role: "bed", label: "Mulch bed", style: { ...MULCH_STYLE } };
  }
}
