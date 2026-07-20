import { describe, expect, it } from "vitest";
import type { GardenView, ImageElement } from "../document/schema";
import {
  isPhotoOverlayVisible,
  photoOverlayOpacity,
  withPhotoOpacity,
  withPhotoVisibility,
} from "./overlayControls";

function image(partial: Partial<ImageElement> = {}): ImageElement {
  return {
    id: "img1",
    type: "image",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    angle: 0,
    seed: 1,
    opacity: 1,
    locked: false,
    href: "/api/photos/x/image",
    visible: true,
    dimmed: true,
    ...partial,
  };
}

function view(els: ImageElement[]): GardenView {
  return {
    id: "v1",
    name: "Plan",
    kind: "topdown",
    elements: els,
  };
}

describe("overlayControls", () => {
  it("reports visibility from image elements", () => {
    expect(isPhotoOverlayVisible(view([image({ visible: true })]))).toBe(true);
    expect(isPhotoOverlayVisible(view([image({ visible: false })]))).toBe(
      false,
    );
  });

  it("folds dimmed into effective opacity", () => {
    expect(photoOverlayOpacity(view([image({ opacity: 1, dimmed: true })]))).toBe(
      0.4,
    );
  });

  it("clears dimmed when showing with visibility helper", () => {
    const next = withPhotoVisibility(image({ dimmed: true, opacity: 1 }), true);
    expect(next.type).toBe("image");
    if (next.type !== "image") return;
    expect(next.visible).toBe(true);
    expect(next.dimmed).toBe(false);
    expect(next.opacity).toBeCloseTo(0.4);
  });

  it("sets opacity and forces visible", () => {
    const next = withPhotoOpacity(image({ visible: false, dimmed: true }), 0.6);
    expect(next.type).toBe("image");
    if (next.type !== "image") return;
    expect(next.visible).toBe(true);
    expect(next.dimmed).toBe(false);
    expect(next.opacity).toBe(0.6);
  });
});
