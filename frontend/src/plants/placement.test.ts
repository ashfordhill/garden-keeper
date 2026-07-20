import { describe, expect, it } from "vitest";
import type { PlantElement } from "../document/schema";
import {
  GROUNDCOVER_SCALE_STEP,
  mergeSprayIntoPatch,
  plantStampSize,
  scaleElementFromCenter,
  speciesUsesSpray,
  spraySpacing,
} from "./placement";

function plant(partial: Partial<PlantElement> & Pick<PlantElement, "id" | "x" | "y" | "width" | "height">): PlantElement {
  return {
    type: "plant",
    angle: 0,
    seed: 1,
    opacity: 1,
    locked: false,
    speciesId: "gk:creeping-phlox",
    showLabel: false,
    ...partial,
  };
}

describe("placement", () => {
  it("only groundcovers use spray", () => {
    expect(speciesUsesSpray("groundcover")).toBe(true);
    expect(speciesUsesSpray("grass")).toBe(false);
    expect(speciesUsesSpray("tree")).toBe(false);
  });

  it("sizes groundcover stamps smaller than trees", () => {
    expect(plantStampSize("groundcover")).toBeLessThan(plantStampSize("tree"));
    expect(plantStampSize("grass")).toBeLessThan(plantStampSize("shrub"));
  });

  it("spaces spray stamps closer than stamp diameter", () => {
    const size = plantStampSize("groundcover");
    expect(spraySpacing("groundcover", size)).toBeLessThan(size);
  });

  it("merges spray stamps into one patch bounding box", () => {
    const a = plant({ id: "a", x: 10, y: 20, width: 32, height: 32 });
    const b = plant({ id: "b", x: 40, y: 30, width: 28, height: 28 });
    const patch = mergeSprayIntoPatch([a, b]);
    expect(patch).not.toBeNull();
    expect(patch!.id).toBe("a");
    expect(patch!.width).toBeGreaterThan(32);
    expect(patch!.height).toBeGreaterThan(32);
    expect(patch!.x).toBeLessThanOrEqual(10);
    expect(patch!.y).toBeLessThanOrEqual(20);
  });

  it("returns the single stamp unchanged when spray has one point", () => {
    const a = plant({ id: "solo", x: 5, y: 5, width: 32, height: 32 });
    expect(mergeSprayIntoPatch([a])).toEqual(a);
  });

  it("scales coverage about center", () => {
    const el = { x: 0, y: 0, width: 100, height: 50 };
    const grown = scaleElementFromCenter(el, GROUNDCOVER_SCALE_STEP);
    expect(grown.width).toBeCloseTo(100 * GROUNDCOVER_SCALE_STEP);
    expect(grown.height).toBeCloseTo(50 * GROUNDCOVER_SCALE_STEP);
    expect(grown.x + grown.width / 2).toBeCloseTo(50);
    expect(grown.y + grown.height / 2).toBeCloseTo(25);
  });
});
