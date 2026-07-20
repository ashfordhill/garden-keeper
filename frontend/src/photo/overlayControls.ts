/**
 * Helpers for the imported original-photo layer on the main canvas
 * (ImageElements written by Import Apply).
 */
import type { Element, GardenView, ImageElement } from "../document/schema";

export function photoImageElements(view: GardenView): ImageElement[] {
  return view.elements.filter((el): el is ImageElement => el.type === "image");
}

export function hasPhotoOverlay(view: GardenView): boolean {
  return photoImageElements(view).length > 0;
}

/** True when at least one photo element is visible. */
export function isPhotoOverlayVisible(view: GardenView): boolean {
  return photoImageElements(view).some((el) => el.visible);
}

/**
 * Effective display opacity (accounts for legacy `dimmed` × 0.4).
 * Used by the toolbar slider.
 */
export function photoOverlayOpacity(view: GardenView): number {
  const imgs = photoImageElements(view);
  if (imgs.length === 0) return 0.4;
  const el = imgs[0];
  return el.opacity * (el.dimmed ? 0.4 : 1);
}

/** Normalize dimmed images so opacity alone controls transparency. */
export function withPhotoVisibility(
  el: Element,
  visible: boolean,
): Element {
  if (el.type !== "image") return el;
  if (!visible) return { ...el, visible: false };
  // On show: fold dimmed into opacity once so the slider is intuitive.
  if (el.dimmed) {
    return {
      ...el,
      visible: true,
      dimmed: false,
      opacity: Math.min(1, Math.max(0.05, el.opacity * 0.4)),
    };
  }
  return { ...el, visible: true };
}

export function withPhotoOpacity(el: Element, opacity: number): Element {
  if (el.type !== "image") return el;
  return {
    ...el,
    dimmed: false,
    opacity: Math.min(1, Math.max(0.05, opacity)),
    visible: true,
  };
}
