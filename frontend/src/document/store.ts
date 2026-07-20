/**
 * Central document store (Zustand). Wave 1 skeleton — Agent A (editor) builds
 * tools/selection interactions on top; Agents D/E read and mutate through the
 * actions here rather than touching the document directly.
 *
 * Undo/redo is snapshot-based: every mutation made through `mutateDocument`
 * pushes the previous document onto the undo stack. Snapshots are cheap at
 * garden scale (hundreds of elements); revisit only if profiling says so.
 */
import { create } from "zustand";
import type { LandscapeDrawTool, StoneVariant } from "../landscape/drawTools";
import {
  createEmptyDocument,
  type Element,
  type GardenDocument,
  type GardenView,
  type PlantSpecies,
  type SeasonPhase,
} from "./schema";

const MAX_HISTORY = 200;

/** Editor tools. Landscape draw tools place styled polygons. */
export type Tool =
  | "select" // V
  | "hand" // H
  | LandscapeDrawTool
  | "plant"; // place plant from palette

export interface EditorState {
  document: GardenDocument;
  /** Element ids selected in the active view. */
  selectedIds: string[];
  activeTool: Tool;
  /** Species picked in the palette; used by the "plant" tool. */
  activeSpeciesId: string | null;
  /** Stone / hardscape fill variant while a stone draw tool is active. */
  stoneVariant: StoneVariant;
  /**
   * Season mode: null = display mode (each plant shows its displayPhase
   * form); otherwise every plant renders its form for this phase.
   */
  seasonPhase: SeasonPhase | null;

  undoStack: GardenDocument[];
  redoStack: GardenDocument[];

  // --- document-level actions -------------------------------------------
  newDocument: () => void;
  loadDocument: (doc: GardenDocument) => void;
  /** All undoable document mutations go through here. */
  mutateDocument: (fn: (doc: GardenDocument) => GardenDocument) => void;
  undo: () => void;
  redo: () => void;

  // --- convenience mutations ---------------------------------------------
  setActiveView: (viewId: string) => void;
  addElement: (element: Element) => void;
  /** Batch insert (one undo step) — used by groundcover spray. */
  addElements: (elements: Element[]) => void;
  updateElements: (
    ids: string[],
    fn: (element: Element) => Element,
  ) => void;
  deleteElements: (ids: string[]) => void;
  upsertSpecies: (species: PlantSpecies) => void;

  // --- ephemeral (not undoable, not persisted) -----------------------------
  setSelectedIds: (ids: string[]) => void;
  setActiveTool: (tool: Tool) => void;
  setActiveSpeciesId: (id: string | null) => void;
  setStoneVariant: (variant: StoneVariant) => void;
  setSeasonPhase: (phase: SeasonPhase | null) => void;
}

function touch(doc: GardenDocument): GardenDocument {
  return { ...doc, updatedAt: new Date().toISOString() };
}

function mutateActiveView(
  doc: GardenDocument,
  fn: (view: GardenView) => GardenView,
): GardenDocument {
  return {
    ...doc,
    views: doc.views.map((v) => (v.id === doc.activeViewId ? fn(v) : v)),
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createEmptyDocument(),
  selectedIds: [],
  activeTool: "select",
  activeSpeciesId: null,
  stoneVariant: "concrete",
  seasonPhase: null,
  undoStack: [],
  redoStack: [],

  newDocument: () =>
    set({
      document: createEmptyDocument(),
      selectedIds: [],
      undoStack: [],
      redoStack: [],
    }),

  loadDocument: (doc) =>
    set({ document: doc, selectedIds: [], undoStack: [], redoStack: [] }),

  mutateDocument: (fn) =>
    set((s) => ({
      document: touch(fn(s.document)),
      undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), s.document],
      redoStack: [],
    })),

  undo: () =>
    set((s) => {
      const prev = s.undoStack.at(-1);
      if (!prev) return s;
      return {
        document: prev,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, s.document],
        selectedIds: [],
      };
    }),

  redo: () =>
    set((s) => {
      const next = s.redoStack.at(-1);
      if (!next) return s;
      return {
        document: next,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, s.document],
        selectedIds: [],
      };
    }),

  setActiveView: (viewId) =>
    get().mutateDocument((doc) => ({ ...doc, activeViewId: viewId })),

  addElement: (element) =>
    get().mutateDocument((doc) =>
      mutateActiveView(doc, (v) => ({
        ...v,
        elements: [...v.elements, element],
      })),
    ),

  addElements: (elements) => {
    if (elements.length === 0) return;
    get().mutateDocument((doc) =>
      mutateActiveView(doc, (v) => ({
        ...v,
        elements: [...v.elements, ...elements],
      })),
    );
  },

  updateElements: (ids, fn) =>
    get().mutateDocument((doc) =>
      mutateActiveView(doc, (v) => ({
        ...v,
        elements: v.elements.map((el) =>
          ids.includes(el.id) ? fn(el) : el,
        ),
      })),
    ),

  deleteElements: (ids) =>
    get().mutateDocument((doc) =>
      mutateActiveView(doc, (v) => ({
        ...v,
        elements: v.elements.filter((el) => !ids.includes(el.id)),
      })),
    ),

  upsertSpecies: (species) =>
    get().mutateDocument((doc) => ({
      ...doc,
      species: { ...doc.species, [species.id]: species },
    })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveSpeciesId: (id) => set({ activeSpeciesId: id }),
  setStoneVariant: (variant) => set({ stoneVariant: variant }),
  setSeasonPhase: (phase) => set({ seasonPhase: phase }),
}));

/** The view currently being edited. */
export function selectActiveView(s: EditorState): GardenView {
  return (
    s.document.views.find((v) => v.id === s.document.activeViewId) ??
    s.document.views[0]
  );
}
