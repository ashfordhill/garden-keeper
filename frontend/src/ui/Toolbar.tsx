/**
 * Top toolbar: hamburger (project + photo), landscape draw tools, undo/redo, zoom.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  selectActiveView,
  useEditorStore,
  type Tool,
} from "../document/store";
import {
  downloadDocument,
  openDocumentFromFile,
} from "../document/persistence";
import { useViewportStore } from "../editor/viewportStore";
import { useImportStore } from "../import/importStore";
import { toolUsesStoneVariants } from "../landscape/drawTools";
import {
  hasPhotoOverlay,
  isPhotoOverlayVisible,
  photoImageElements,
  photoOverlayOpacity,
  withPhotoOpacity,
  withPhotoVisibility,
} from "../photo/overlayControls";
import { StoneVariantWheel } from "./StoneVariantWheel";

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
      tool: "stonePath",
      label: "Add stone path",
      hotkey: "S",
      icon: icon(
        <path d="M3.5 13.5c2-.5 3-2.5 4.5-2.5s2.5 2 4.5 2.5 3-.5 4-2M4 8.5c1.5 1 3 .5 4.5.5s3 1.5 4.5.5 2.5-1 3.5-.5" />,
      ),
    },
    {
      tool: "grassPath",
      label: "Add grass path",
      hotkey: "G",
      icon: icon(
        <>
          <path d="M3 14c2.5-1 4-3 7-3s4.5 2 7 3" />
          <path d="M6 11.5V7M10 11V5.5M14 11.5V7.5" />
        </>,
      ),
    },
    {
      tool: "mulchBed",
      label: "Add mulch bed",
      hotkey: "M",
      icon: icon(
        <path d="M4 13.5c1.5-3 3-5.5 6-5.5s4.5 2.5 6 5.5M5.5 10.5c.8-1.2 1.8-2 3.2-2s2.5.8 3.3 2" />,
      ),
    },
    {
      tool: "hardscape",
      label: "Add hardscape",
      hotkey: "K",
      icon: icon(
        <>
          <path d="M3.5 12.5l3-6h7l3 6z" />
          <path d="M6 12.5l2-3.5h4l2 3.5" />
        </>,
      ),
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
      type="button"
      className={`flex h-8 w-8 items-center justify-center rounded ${
        active
          ? "bg-gk-accent-soft text-gk-accent"
          : "text-gk-ink hover:bg-gk-hover"
      } disabled:pointer-events-none disabled:opacity-30`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="w-full rounded-md px-3 py-2 text-left text-sm text-gk-ink hover:bg-gk-hover"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Toolbar() {
  const doc = useEditorStore((s) => s.document);
  const view = useEditorStore(selectActiveView);
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const newDocument = useEditorStore((s) => s.newDocument);
  const updateElements = useEditorStore((s) => s.updateElements);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const stoneVariant = useEditorStore((s) => s.stoneVariant);
  const setStoneVariant = useEditorStore((s) => s.setStoneVariant);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const openWizard = useImportStore((s) => s.openWizard);

  const zoom = useViewportStore((s) => s.viewport.zoom);
  const resetZoom = useViewportStore((s) => s.resetZoom);

  const [menuOpen, setMenuOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  const photoAvailable = hasPhotoOverlay(view);
  const photoVisible = isPhotoOverlayVisible(view);
  const photoOpacity = photoOverlayOpacity(view);

  function togglePhotoOverlay() {
    const imgs = photoImageElements(view);
    if (imgs.length === 0) return;
    const next = !isPhotoOverlayVisible(view);
    updateElements(
      imgs.map((el) => el.id),
      (el) => withPhotoVisibility(el, next),
    );
  }

  function setPhotoOpacity(opacity: number) {
    const imgs = photoImageElements(view);
    if (imgs.length === 0) return;
    updateElements(
      imgs.map((el) => el.id),
      (el) => withPhotoOpacity(el, opacity),
    );
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!toolUsesStoneVariants(activeTool)) setWheelOpen(false);
  }, [activeTool]);

  useEffect(() => {
    if (!wheelOpen) return;
    function onDoc(e: MouseEvent) {
      if (!wheelRef.current?.contains(e.target as Node)) setWheelOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setWheelOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [wheelOpen]);

  function activateTool(tool: Tool) {
    setActiveTool(tool);
    // Stone path / hardscape: open the pizza-wheel variant picker under the tools.
    setWheelOpen(toolUsesStoneVariants(tool));
  }

  return (
    <div className="relative flex items-center gap-2 rounded-lg border border-gk-line bg-gk-panel px-3 py-1.5 shadow-md">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded text-gk-ink hover:bg-gk-hover"
          title="Menu"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {icon(
            <>
              <path d="M3.5 5.5h13" />
              <path d="M3.5 10h13" />
              <path d="M3.5 14.5h13" />
            </>,
          )}
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-gk-line bg-gk-panel p-1.5 shadow-lg"
          >
            <MenuItem
              onClick={() => {
                newDocument();
                setMenuOpen(false);
              }}
            >
              New project
            </MenuItem>
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                void openDocumentFromFile().then(loadDocument, console.error);
              }}
            >
              Load project…
            </MenuItem>
            <MenuItem
              onClick={() => {
                downloadDocument(doc);
                setMenuOpen(false);
              }}
            >
              Save project
            </MenuItem>
            <div className="my-1 border-t border-gk-line" />
            <MenuItem
              onClick={() => {
                setMenuOpen(false);
                openWizard();
              }}
            >
              Import landscape…
            </MenuItem>
            {photoAvailable && (
              <>
                <div className="my-1 border-t border-gk-line" />
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-gk-ink hover:bg-gk-hover">
                  <input
                    type="checkbox"
                    checked={photoVisible}
                    onChange={() => togglePhotoOverlay()}
                  />
                  <span className="flex-1">Original photo</span>
                  <span className="text-[10px] text-gk-muted">O</span>
                </label>
                {photoVisible && (
                  <label className="flex flex-col gap-1 px-3 py-2 text-xs text-gk-muted">
                    Opacity
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={photoOpacity}
                      onChange={(e) =>
                        setPhotoOpacity(Number(e.target.value))
                      }
                    />
                  </label>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <span className="text-sm font-semibold text-gk-ink">Garden Keeper</span>
      <span className="text-gk-line">|</span>
      <div className="relative flex items-center gap-2" ref={wheelRef}>
        {TOOLS.map(({ tool, label, hotkey, icon: toolIcon }) => (
          <ToolButton
            key={tool}
            active={activeTool === tool}
            title={`${label} — ${hotkey}`}
            onClick={() => activateTool(tool)}
          >
            {toolIcon}
          </ToolButton>
        ))}
        {wheelOpen && toolUsesStoneVariants(activeTool) && (
          <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2">
            <StoneVariantWheel
              value={stoneVariant}
              onChange={(v) => {
                setStoneVariant(v);
                setWheelOpen(false);
              }}
            />
          </div>
        )}
      </div>
      <span className="text-gk-line">|</span>
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
        type="button"
        className="w-14 rounded px-1 py-1 text-center text-sm tabular-nums text-gk-ink hover:bg-gk-hover"
        title="Reset zoom to 100%"
        onClick={() => resetZoom()}
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}
