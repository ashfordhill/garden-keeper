/**
 * Global editor hotkeys. Tool keys are single letters;
 * everything is suppressed while the user is typing in an input, textarea,
 * or contenteditable so text editing never triggers tools.
 */
import { useEffect } from "react";
import { useEditorStore, selectActiveView, type Tool } from "../document/store";
import { newId, newSeed, type Element } from "../document/schema";
import {
  isPhotoOverlayVisible,
  photoImageElements,
  withPhotoVisibility,
} from "../photo/overlayControls";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  "1": "select",
  h: "hand",
  s: "stonePath",
  g: "grassPath",
  m: "mulchBed",
  k: "hardscape",
};

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function duplicateSelection(): void {
  const s = useEditorStore.getState();
  const view = selectActiveView(s);
  const selected = view.elements.filter((el) =>
    s.selectedIds.includes(el.id),
  );
  if (selected.length === 0) return;
  const copies: Element[] = selected.map((el) => ({
    ...el,
    id: newId(),
    seed: newSeed(),
    x: el.x + 10,
    y: el.y + 10,
  }));
  s.mutateDocument((doc) => ({
    ...doc,
    views: doc.views.map((v) =>
      v.id === doc.activeViewId
        ? { ...v, elements: [...v.elements, ...copies] }
        : v,
    ),
  }));
  s.setSelectedIds(copies.map((el) => el.id));
}

/**
 * Installs the editor's global keydown handler.
 * `onEscape` lets the canvas cancel in-progress drafts (polygon, text edit)
 * before selection is cleared; return true to consume the event.
 */
export function useHotkeys(onEscape?: () => boolean) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      const s = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          s.undo();
        } else if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          s.redo();
        } else if (key === "d") {
          e.preventDefault();
          duplicateSelection();
        } else if (key === "a") {
          e.preventDefault();
          const view = selectActiveView(s);
          s.setSelectedIds(
            view.elements.filter((el) => !el.locked).map((el) => el.id),
          );
        }
        return;
      }

      if (e.key === "Escape") {
        if (onEscape?.()) return;
        if (s.selectedIds.length > 0) s.setSelectedIds([]);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedIds.length > 0) {
          e.preventDefault();
          s.deleteElements(s.selectedIds);
          s.setSelectedIds([]);
        }
        return;
      }

      if (e.key.startsWith("Arrow")) {
        if (s.selectedIds.length === 0) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        s.updateElements(s.selectedIds, (el) =>
          el.locked ? el : { ...el, x: el.x + dx, y: el.y + dy },
        );
        return;
      }

      // Toggle imported original photo overlay (O).
      if (e.key.toLowerCase() === "o" && !e.altKey) {
        const view = selectActiveView(s);
        const imgs = photoImageElements(view);
        if (imgs.length > 0) {
          e.preventDefault();
          const next = !isPhotoOverlayVisible(view);
          s.updateElements(
            imgs.map((el) => el.id),
            (el) => withPhotoVisibility(el, next),
          );
        }
        return;
      }

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool && !e.altKey) {
        s.setActiveTool(tool);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}
