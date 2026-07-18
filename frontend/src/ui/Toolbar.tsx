/**
 * Floating toolbar: document actions (New/Open/Save), drawing tools with
 * single-key hotkeys, undo/redo, and a zoom indicator (click = reset to 100%).
 */
import type { ReactNode } from "react";
import { useEditorStore, type Tool } from "../document/store";
import {
  downloadDocument,
  openDocumentFromFile,
} from "../document/persistence";
import { useViewportStore } from "../editor/viewportStore";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function icon(children: ReactNode) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" {...STROKE}>
      {children}
    </svg>
  );
}

const TOOLS: { tool: Tool; label: string; hotkey: string; icon: ReactNode }[] =
  [
    {
      tool: "select",
      label: "Select",
      hotkey: "V or 1",
      icon: icon(<path d="M5 3l10 7.5-4.5 1L8.5 16z" />),
    },
    {
      tool: "hand",
      label: "Hand (pan)",
      hotkey: "H",
      icon: icon(
        <path d="M7 9V4.5a1.2 1.2 0 012.4 0V9m0-5v-.5a1.2 1.2 0 012.4 0V9m0-4a1.2 1.2 0 012.4 0v6.5a5.5 5.5 0 01-11 0v-3a1.2 1.2 0 012.2-.6" />,
      ),
    },
    {
      tool: "rect",
      label: "Rectangle",
      hotkey: "R",
      icon: icon(<rect x="3.5" y="4.5" width="13" height="11" rx="1" />),
    },
    {
      tool: "ellipse",
      label: "Ellipse",
      hotkey: "E",
      icon: icon(<ellipse cx="10" cy="10" rx="6.5" ry="5.5" />),
    },
    {
      tool: "polygon",
      label: "Polygon",
      hotkey: "P",
      icon: icon(<path d="M10 3.5l6 4.5-2.3 7h-7.4L4 8z" />),
    },
    {
      tool: "freehand",
      label: "Draw",
      hotkey: "D",
      icon: icon(<path d="M3.5 14c3-6 5-8 6.5-6.5S8.5 13 11 13s4-4 5.5-6.5" />),
    },
    {
      tool: "text",
      label: "Text",
      hotkey: "T",
      icon: icon(<path d="M4.5 5.5V4h11v1.5M10 4v12m-2 0h4" />),
    },
  ];

function ToolButton({
  active,
  title,
  onClick,
  disabled,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={`flex h-8 w-8 items-center justify-center rounded ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-neutral-700 hover:bg-neutral-100"
      } disabled:pointer-events-none disabled:opacity-30`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Toolbar() {
  const doc = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const newDocument = useEditorStore((s) => s.newDocument);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);

  const zoom = useViewportStore((s) => s.viewport.zoom);
  const resetZoom = useViewportStore((s) => s.resetZoom);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 shadow-md">
      <span className="text-sm font-semibold">Garden Keeper</span>
      <span className="text-neutral-300">|</span>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={newDocument}
      >
        New
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={() => openDocumentFromFile().then(loadDocument, console.error)}
      >
        Open
      </button>
      <button
        className="rounded px-2 py-1 text-sm hover:bg-neutral-100"
        onClick={() => downloadDocument(doc)}
      >
        Save
      </button>
      <span className="text-neutral-300">|</span>
      {TOOLS.map(({ tool, label, hotkey, icon: toolIcon }) => (
        <ToolButton
          key={tool}
          active={activeTool === tool}
          title={`${label} — ${hotkey}`}
          onClick={() => setActiveTool(tool)}
        >
          {toolIcon}
        </ToolButton>
      ))}
      <span className="text-neutral-300">|</span>
      <ToolButton title="Undo — Ctrl+Z" onClick={undo} disabled={!canUndo}>
        {icon(<path d="M8 5L4 9l4 4M4.5 9H12a4 4 0 010 8h-2" />)}
      </ToolButton>
      <ToolButton
        title="Redo — Ctrl+Shift+Z / Ctrl+Y"
        onClick={redo}
        disabled={!canRedo}
      >
        {icon(<path d="M12 5l4 4-4 4M15.5 9H8a4 4 0 000 8h2" />)}
      </ToolButton>
      <button
        className="w-14 rounded px-1 py-1 text-center text-sm tabular-nums text-neutral-700 hover:bg-neutral-100"
        title="Reset zoom to 100%"
        onClick={() => resetZoom()}
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}
