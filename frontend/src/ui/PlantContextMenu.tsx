/**
 * Right-click menu for selected / hit plants on the canvas.
 */
import { useEffect, useRef, type ReactNode } from "react";
import type { PlantElement } from "../document/schema";
import { selectActiveView, useEditorStore } from "../document/store";
import { duplicateSelection } from "../editor/useHotkeys";
import { BUILTIN_SPECIES_BY_ID } from "../plants/catalog";
import {
  GROUNDCOVER_SCALE_STEP,
  scaleElementFromCenter,
} from "../plants/placement";

export interface PlantContextMenuState {
  clientX: number;
  clientY: number;
  plantIds: string[];
}

export function PlantContextMenu({
  menu,
  onClose,
}: {
  menu: PlantContextMenuState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const view = useEditorStore(selectActiveView);
  const docSpecies = useEditorStore((s) => s.document.species);
  const updateElements = useEditorStore((s) => s.updateElements);
  const deleteElements = useEditorStore((s) => s.deleteElements);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);

  const plants: PlantElement[] = [];
  for (const id of menu.plantIds) {
    const el = view.elements.find((e) => e.id === id);
    if (el?.type === "plant") plants.push(el);
  }

  const allGroundcover =
    plants.length > 0 &&
    plants.every((el) => {
      const sp =
        docSpecies[el.speciesId] ?? BUILTIN_SPECIES_BY_ID.get(el.speciesId);
      return sp?.archetype === "groundcover";
    });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function scaleCoverage(factor: number) {
    updateElements(menu.plantIds, (el) => {
      if (el.type !== "plant" || el.locked) return el;
      return scaleElementFromCenter(el, factor);
    });
    onClose();
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[80] min-w-44 rounded-xl border border-gk-line bg-gk-panel p-1.5 shadow-lg"
      style={{ left: menu.clientX, top: menu.clientY }}
    >
      {allGroundcover && (
        <>
          <MenuItem onClick={() => scaleCoverage(GROUNDCOVER_SCALE_STEP)}>
            Expand coverage
          </MenuItem>
          <MenuItem
            onClick={() => scaleCoverage(1 / GROUNDCOVER_SCALE_STEP)}
          >
            Shrink coverage
          </MenuItem>
          <div className="my-1 border-t border-gk-line" />
        </>
      )}
      <MenuItem
        onClick={() => {
          setSelectedIds(menu.plantIds);
          duplicateSelection();
          onClose();
        }}
      >
        Duplicate
      </MenuItem>
      <MenuItem
        onClick={() => {
          deleteElements(menu.plantIds);
          setSelectedIds([]);
          onClose();
        }}
        danger
      >
        Delete
      </MenuItem>
    </div>
  );
}

function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gk-hover ${
        danger ? "text-gk-danger" : "text-gk-ink"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
