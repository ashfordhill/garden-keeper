/**
 * The infinite Excalidraw-style editor canvas.
 *
 * - Viewport (pan/zoom) is ephemeral, kept in viewportStore (never in the doc).
 * - All interactions run as a local "session" (pan / marquee / move / resize /
 *   rotate / draw / freehand); previews are computed locally and the document
 *   store is mutated ONCE on pointerup, so each gesture is one undo step.
 * - Elements render in a zoomed <g>; selection chrome renders in screen space
 *   so handles stay a constant pixel size.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  newId,
  newSeed,
  type Element,
  type Point,
} from "../document/schema";
import { selectActiveView, useEditorStore } from "../document/store";
import { ElementRenderer, TEXT_FONT_FAMILY } from "./ElementRenderer";
import {
  boxFromPoints,
  boxOf,
  boundsOfPoints,
  boxesIntersect,
  elementAABB,
  normalizePoints,
  pointInRotatedBox,
  type Box,
} from "./geometry";
import {
  resizeBox,
  resizeRotatedBox,
  rotationFromPointer,
  scaleBoxInGroup,
  type HandleKind,
} from "./resize";
import { smoothOpenPath } from "./rough";
import {
  SelectionOverlay,
  getSelectionGeometry,
  type SelectionGeometry,
} from "./SelectionOverlay";
import { useHotkeys, isTypingTarget } from "./useHotkeys";
import { gridStep, screenToCanvas, canvasToScreen } from "./viewport";
import { useViewportStore } from "./viewportStore";

const DEFAULT_STYLE = {
  strokeColor: "#1e1e1e",
  fillColor: "transparent",
  strokeWidth: 2,
};
const DEFAULT_FONT_SIZE = 20;
const CLICK_SLOP_PX = 3;

// ---------------------------------------------------------------------------
// Interaction sessions
// ---------------------------------------------------------------------------

type Session =
  | { kind: "pan"; lastScreen: Point }
  | {
      kind: "marquee";
      startCanvas: Point;
      currentCanvas: Point;
      baseSelection: string[];
    }
  | {
      kind: "move";
      ids: string[];
      startCanvas: Point;
      dx: number;
      dy: number;
      moved: boolean;
      downId: string;
      wasSelected: boolean;
      shift: boolean;
    }
  | {
      kind: "resize";
      handle: HandleKind;
      startGeo: SelectionGeometry;
      startBoxes: Map<string, Box>;
      boxes: Map<string, Box>;
    }
  | { kind: "rotate"; id: string; center: Point; angle: number }
  | {
      kind: "draw";
      tool: "rect" | "ellipse";
      startCanvas: Point;
      currentCanvas: Point;
      seed: number;
    }
  | { kind: "freehand"; points: Point[]; seed: number };

interface PolygonDraft {
  points: Point[];
  cursor: Point | null;
}

interface TextEdit {
  /** null = creating a new text element. */
  id: string | null;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Text measurement (for sizing text element boxes)
// ---------------------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;

function measureTextBox(text: string, fontSize: number) {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  const lines = text.split("\n");
  let width = 10;
  if (measureCtx) {
    measureCtx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
    for (const line of lines) {
      width = Math.max(width, measureCtx.measureText(line).width);
    }
  } else {
    width = Math.max(...lines.map((l) => l.length)) * fontSize * 0.6;
  }
  return { width, height: lines.length * fontSize * 1.25 };
}

// ---------------------------------------------------------------------------

function isHittable(el: Element): boolean {
  if (el.locked) return false;
  if (el.type === "image" && !el.visible) return false;
  return true;
}

function hitTest(elements: Element[], p: Point): Element | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (!isHittable(el)) continue;
    if (pointInRotatedBox(p, boxOf(el), el.angle)) return el;
  }
  return null;
}

export function EditorCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const view = useEditorStore(selectActiveView);
  const doc = useEditorStore((s) => s.document);
  const seasonPhase = useEditorStore((s) => s.seasonPhase);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activeTool = useEditorStore((s) => s.activeTool);
  const activeSpeciesId = useEditorStore((s) => s.activeSpeciesId);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const addElement = useEditorStore((s) => s.addElement);
  const updateElements = useEditorStore((s) => s.updateElements);
  const deleteElements = useEditorStore((s) => s.deleteElements);

  const viewport = useViewportStore((s) => s.viewport);

  const [session, setSession] = useState<Session | null>(null);
  const [polygonDraft, setPolygonDraft] = useState<PolygonDraft | null>(null);
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const toScreen = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }, []);

  const toCanvas = useCallback(
    (e: { clientX: number; clientY: number }) =>
      screenToCanvas(useViewportStore.getState().viewport, toScreen(e)),
    [toScreen],
  );

  // --- wheel: pan / ctrl+wheel: zoom-to-cursor (non-passive) ---------------
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const { viewport: vp, panViewportBy, zoomViewportAt } =
        useViewportStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.pow(1.0018, -e.deltaY);
        zoomViewportAt(toScreen(e), vp.zoom * factor);
      } else if (e.shiftKey && e.deltaX === 0) {
        panViewportBy(-e.deltaY, 0);
      } else {
        panViewportBy(-e.deltaX, -e.deltaY);
      }
    }
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toScreen]);

  // --- space = temporary hand tool -----------------------------------------
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // --- polygon draft: Enter closes ------------------------------------------
  const closePolygon = useCallback(
    (draft: PolygonDraft) => {
      setPolygonDraft(null);
      // Drop near-duplicate trailing points (double-click adds an extra one).
      const pts = draft.points.filter(
        (p, i, arr) =>
          i === 0 ||
          Math.hypot(p.x - arr[i - 1].x, p.y - arr[i - 1].y) > 0.5,
      );
      if (pts.length < 3) return;
      const box = boundsOfPoints(pts);
      const el: Element = {
        id: newId(),
        type: "polygon",
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        angle: 0,
        seed: newSeed(),
        opacity: 1,
        locked: false,
        points: normalizePoints(pts, box),
        style: { ...DEFAULT_STYLE },
        role: "generic",
      };
      addElement(el);
      setSelectedIds([el.id]);
      setActiveTool("select");
    },
    [addElement, setSelectedIds, setActiveTool],
  );

  useEffect(() => {
    if (!polygonDraft) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && !isTypingTarget(e.target) && polygonDraft) {
        e.preventDefault();
        closePolygon(polygonDraft);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [polygonDraft, closePolygon]);

  // --- text editing ---------------------------------------------------------
  const commitTextEdit = useCallback(
    (edit: TextEdit) => {
      setTextEdit(null);
      const value = edit.value.replace(/\s+$/, "");
      if (edit.id) {
        if (value === "") {
          deleteElements([edit.id]);
          setSelectedIds([]);
          return;
        }
        const size = measureTextBox(value, edit.fontSize);
        updateElements([edit.id], (el) =>
          el.type === "text"
            ? { ...el, text: value, width: size.width, height: size.height }
            : el,
        );
      } else {
        if (value === "") return;
        const size = measureTextBox(value, edit.fontSize);
        const el: Element = {
          id: newId(),
          type: "text",
          x: edit.x,
          y: edit.y,
          width: size.width,
          height: size.height,
          angle: 0,
          seed: newSeed(),
          opacity: 1,
          locked: false,
          text: value,
          fontSize: edit.fontSize,
          color: edit.color,
        };
        addElement(el);
        setSelectedIds([el.id]);
      }
    },
    [addElement, updateElements, deleteElements, setSelectedIds],
  );

  useEffect(() => {
    if (textEdit) {
      // Focus after the overlay mounts.
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [textEdit != null]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- escape: cancel drafts before clearing selection ----------------------
  const onEscape = useCallback((): boolean => {
    if (polygonDraft) {
      setPolygonDraft(null);
      return true;
    }
    if (sessionRef.current) {
      setSession(null);
      return true;
    }
    return false;
  }, [polygonDraft]);

  useHotkeys(onEscape);

  // --- pointer handlers ------------------------------------------------------
  const startSession = useCallback((e: React.PointerEvent, s: Session) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    setSession(s);
  }, []);

  const onHandlePointerDown = useCallback(
    (handle: HandleKind, e: React.PointerEvent) => {
      const s = useEditorStore.getState();
      const activeView = selectActiveView(s);
      const selected = activeView.elements.filter(
        (el) => s.selectedIds.includes(el.id) && !el.locked,
      );
      const geo = getSelectionGeometry(selected);
      if (!geo) return;
      startSession(e, {
        kind: "resize",
        handle,
        startGeo: geo,
        startBoxes: new Map(selected.map((el) => [el.id, boxOf(el)])),
        boxes: new Map(),
      });
    },
    [startSession],
  );

  const onRotatePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const s = useEditorStore.getState();
      const activeView = selectActiveView(s);
      const el = activeView.elements.find(
        (x) => x.id === s.selectedIds[0] && !x.locked,
      );
      if (!el || s.selectedIds.length !== 1) return;
      startSession(e, {
        kind: "rotate",
        id: el.id,
        center: { x: el.x + el.width / 2, y: el.y + el.height / 2 },
        angle: el.angle,
      });
    },
    [startSession],
  );

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (textEdit) {
      commitTextEdit(textEdit);
      return;
    }
    const screen = toScreen(e);
    const canvas = toCanvas(e);

    // Pan: middle button, space, or hand tool.
    if (e.button === 1 || spaceDown || activeTool === "hand") {
      e.preventDefault();
      startSession(e, { kind: "pan", lastScreen: screen });
      return;
    }
    if (e.button !== 0) return;

    switch (activeTool) {
      case "rect":
      case "ellipse":
        startSession(e, {
          kind: "draw",
          tool: activeTool,
          startCanvas: canvas,
          currentCanvas: canvas,
          seed: newSeed(),
        });
        return;
      case "freehand":
        startSession(e, { kind: "freehand", points: [canvas], seed: newSeed() });
        return;
      case "polygon":
        setPolygonDraft((d) =>
          d
            ? { points: [...d.points, canvas], cursor: canvas }
            : { points: [canvas], cursor: canvas },
        );
        return;
      case "text": {
        setTextEdit({
          id: null,
          x: canvas.x,
          y: canvas.y - DEFAULT_FONT_SIZE / 2,
          fontSize: DEFAULT_FONT_SIZE,
          color: "#1e1e1e",
          value: "",
        });
        setActiveTool("select");
        return;
      }
      case "plant": {
        if (!activeSpeciesId) return;
        const SIZE = 60;
        const el: Element = {
          id: newId(),
          type: "plant",
          x: canvas.x - SIZE / 2,
          y: canvas.y - SIZE / 2,
          width: SIZE,
          height: SIZE,
          angle: 0,
          seed: newSeed(),
          opacity: 1,
          locked: false,
          speciesId: activeSpeciesId,
          showLabel: false,
        };
        addElement(el);
        setSelectedIds([el.id]);
        return;
      }
      case "select": {
        const hit = hitTest(view.elements, canvas);
        if (hit) {
          const wasSelected = selectedIds.includes(hit.id);
          let ids: string[];
          if (e.shiftKey) {
            ids = wasSelected
              ? selectedIds.filter((id) => id !== hit.id)
              : [...selectedIds, hit.id];
            setSelectedIds(ids);
            if (wasSelected) return; // toggled off: no move
          } else {
            ids = wasSelected ? selectedIds : [hit.id];
            if (!wasSelected) setSelectedIds(ids);
          }
          startSession(e, {
            kind: "move",
            ids,
            startCanvas: canvas,
            dx: 0,
            dy: 0,
            moved: false,
            downId: hit.id,
            wasSelected,
            shift: e.shiftKey,
          });
        } else {
          startSession(e, {
            kind: "marquee",
            startCanvas: canvas,
            currentCanvas: canvas,
            baseSelection: e.shiftKey ? selectedIds : [],
          });
          if (!e.shiftKey && selectedIds.length > 0) setSelectedIds([]);
        }
        return;
      }
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const s = sessionRef.current;
    if (!s) {
      if (polygonDraft) {
        const canvas = toCanvas(e);
        setPolygonDraft((d) => (d ? { ...d, cursor: canvas } : d));
      }
      return;
    }
    const screen = toScreen(e);
    const canvas = toCanvas(e);

    switch (s.kind) {
      case "pan": {
        useViewportStore
          .getState()
          .panViewportBy(screen.x - s.lastScreen.x, screen.y - s.lastScreen.y);
        setSession({ ...s, lastScreen: screen });
        return;
      }
      case "marquee": {
        const next = { ...s, currentCanvas: canvas };
        setSession(next);
        const marquee = boxFromPoints(next.startCanvas, next.currentCanvas);
        const inside = view.elements
          .filter(isHittable)
          .filter((el) =>
            boxesIntersect(marquee, elementAABB(boxOf(el), el.angle)),
          )
          .map((el) => el.id);
        setSelectedIds([...new Set([...s.baseSelection, ...inside])]);
        return;
      }
      case "move": {
        const dx = canvas.x - s.startCanvas.x;
        const dy = canvas.y - s.startCanvas.y;
        const zoom = useViewportStore.getState().viewport.zoom;
        const moved =
          s.moved || Math.hypot(dx, dy) * zoom > CLICK_SLOP_PX;
        setSession({ ...s, dx, dy, moved });
        return;
      }
      case "resize": {
        const keepAspect = e.shiftKey;
        const boxes = new Map<string, Box>();
        if (s.startGeo.single) {
          const [id, startBox] = [...s.startBoxes.entries()][0];
          boxes.set(
            id,
            resizeRotatedBox(
              startBox,
              s.startGeo.angle,
              s.handle,
              canvas,
              keepAspect,
            ),
          );
        } else {
          const to = resizeBox(s.startGeo.box, s.handle, canvas, keepAspect);
          for (const [id, b] of s.startBoxes) {
            boxes.set(id, scaleBoxInGroup(b, s.startGeo.box, to));
          }
        }
        setSession({ ...s, boxes });
        return;
      }
      case "rotate": {
        setSession({
          ...s,
          angle: rotationFromPointer(s.center, canvas, e.shiftKey),
        });
        return;
      }
      case "draw":
        setSession({ ...s, currentCanvas: canvas });
        return;
      case "freehand": {
        const last = s.points[s.points.length - 1];
        const zoom = useViewportStore.getState().viewport.zoom;
        if (Math.hypot(canvas.x - last.x, canvas.y - last.y) * zoom < 1.5) {
          return;
        }
        setSession({ ...s, points: [...s.points, canvas] });
        return;
      }
    }
  }

  function onPointerUp() {
    const s = sessionRef.current;
    if (!s) return;
    setSession(null);

    switch (s.kind) {
      case "pan":
      case "marquee":
        return;
      case "move": {
        if (s.moved) {
          const { dx, dy } = s;
          updateElements(s.ids, (el) => ({
            ...el,
            x: el.x + dx,
            y: el.y + dy,
          }));
        } else if (!s.shift && s.wasSelected && selectedIds.length > 1) {
          // Plain click on one element of a multi-selection: narrow to it.
          setSelectedIds([s.downId]);
        }
        return;
      }
      case "resize": {
        if (s.boxes.size === 0) return;
        const boxes = s.boxes;
        updateElements([...boxes.keys()], (el) => {
          const b = boxes.get(el.id);
          return b ? { ...el, ...b } : el;
        });
        return;
      }
      case "rotate": {
        const angle = s.angle;
        updateElements([s.id], (el) => ({ ...el, angle }));
        return;
      }
      case "draw": {
        const box = boxFromPoints(s.startCanvas, s.currentCanvas);
        if (box.width < 2 && box.height < 2) return; // stray click
        const el: Element = {
          id: newId(),
          type: s.tool,
          x: box.x,
          y: box.y,
          width: Math.max(2, box.width),
          height: Math.max(2, box.height),
          angle: 0,
          seed: s.seed,
          opacity: 1,
          locked: false,
          style: { ...DEFAULT_STYLE },
          role: "generic",
        };
        addElement(el);
        setSelectedIds([el.id]);
        setActiveTool("select");
        return;
      }
      case "freehand": {
        if (s.points.length < 2) return;
        const box = boundsOfPoints(s.points);
        const el: Element = {
          id: newId(),
          type: "freehand",
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          angle: 0,
          seed: s.seed,
          opacity: 1,
          locked: false,
          points: normalizePoints(s.points, box),
          style: { ...DEFAULT_STYLE },
        };
        addElement(el);
        setSelectedIds([el.id]);
        setActiveTool("select");
        return;
      }
    }
  }

  function onDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (polygonDraft) {
      closePolygon(polygonDraft);
      return;
    }
    if (activeTool !== "select") return;
    const canvas = toCanvas(e);
    const hit = hitTest(view.elements, canvas);
    if (hit?.type === "text") {
      setTextEdit({
        id: hit.id,
        x: hit.x,
        y: hit.y,
        fontSize: hit.fontSize,
        color: hit.color,
        value: hit.text,
      });
      setSelectedIds([]);
    }
  }

  // --- preview elements (session applied locally, committed on pointerup) ---
  const elements = useMemo(() => {
    let els = view.elements;
    if (textEdit?.id) els = els.filter((el) => el.id !== textEdit.id);
    if (!session) return els;
    switch (session.kind) {
      case "move":
        if (!session.moved) return els;
        return els.map((el) =>
          session.ids.includes(el.id)
            ? { ...el, x: el.x + session.dx, y: el.y + session.dy }
            : el,
        );
      case "resize":
        return els.map((el) => {
          const b = session.boxes.get(el.id);
          return b ? { ...el, ...b } : el;
        });
      case "rotate":
        return els.map((el) =>
          el.id === session.id ? { ...el, angle: session.angle } : el,
        );
      default:
        return els;
    }
  }, [view.elements, session, textEdit]);

  // Draft shape while drawing.
  const draft: Element | null = useMemo(() => {
    if (session?.kind !== "draw") return null;
    const box = boxFromPoints(session.startCanvas, session.currentCanvas);
    return {
      id: "__draft__",
      type: session.tool,
      x: box.x,
      y: box.y,
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
      angle: 0,
      seed: session.seed,
      opacity: 1,
      locked: false,
      style: { ...DEFAULT_STYLE },
      role: "generic",
    };
  }, [session]);

  const selectedElements = useMemo(
    () =>
      elements.filter((el) => selectedIds.includes(el.id) && !el.locked),
    [elements, selectedIds],
  );
  const selectionGeo =
    activeTool === "select" && session?.kind !== "marquee"
      ? getSelectionGeometry(selectedElements)
      : null;

  // Marquee rect in screen space.
  const marqueeScreen =
    session?.kind === "marquee"
      ? boxFromPoints(
          canvasToScreen(viewport, session.startCanvas),
          canvasToScreen(viewport, session.currentCanvas),
        )
      : null;

  // Dot grid.
  const step = gridStep(viewport.zoom);
  const gridSize = step * viewport.zoom;

  const cursor =
    session?.kind === "pan"
      ? "grabbing"
      : spaceDown || activeTool === "hand"
        ? "grab"
        : activeTool === "select"
          ? "default"
          : activeTool === "text"
            ? "text"
            : "crosshair";

  const textEditScreen = textEdit
    ? canvasToScreen(viewport, { x: textEdit.x, y: textEdit.y })
    : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none"
        data-testid="editor-canvas"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setSession(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern
            id="dot-grid"
            patternUnits="userSpaceOnUse"
            width={gridSize}
            height={gridSize}
            x={((viewport.offsetX % gridSize) + gridSize) % gridSize}
            y={((viewport.offsetY % gridSize) + gridSize) % gridSize}
          >
            <circle cx={0} cy={0} r={1} fill="#d4d4d4" />
            <circle cx={gridSize} cy={0} r={1} fill="#d4d4d4" />
            <circle cx={0} cy={gridSize} r={1} fill="#d4d4d4" />
            <circle cx={gridSize} cy={gridSize} r={1} fill="#d4d4d4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />

        <g
          transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.zoom})`}
        >
          {elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              species={doc.species}
              seasonPhase={seasonPhase}
            />
          ))}
          {draft && (
            <ElementRenderer
              element={draft}
              species={doc.species}
              seasonPhase={seasonPhase}
            />
          )}
          {session?.kind === "freehand" && (
            <path
              d={smoothOpenPath(session.points)}
              fill="none"
              stroke={DEFAULT_STYLE.strokeColor}
              strokeWidth={DEFAULT_STYLE.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {polygonDraft && (
            <g>
              <polyline
                points={[
                  ...polygonDraft.points,
                  ...(polygonDraft.cursor ? [polygonDraft.cursor] : []),
                ]
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke="#6965db"
                strokeWidth={2 / viewport.zoom}
                strokeDasharray={`${4 / viewport.zoom} ${4 / viewport.zoom}`}
              />
              {polygonDraft.points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3 / viewport.zoom}
                  fill="#6965db"
                />
              ))}
            </g>
          )}
        </g>

        {/* Screen-space chrome */}
        {selectionGeo && (
          <SelectionOverlay
            geometry={selectionGeo}
            viewport={viewport}
            onHandlePointerDown={onHandlePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        )}
        {marqueeScreen && (
          <rect
            x={marqueeScreen.x}
            y={marqueeScreen.y}
            width={marqueeScreen.width}
            height={marqueeScreen.height}
            fill="rgba(105, 101, 219, 0.08)"
            stroke="#6965db"
            strokeWidth={1}
          />
        )}
      </svg>

      {/* Inline text editor overlay */}
      {textEdit && textEditScreen && (
        <textarea
          ref={textareaRef}
          className="absolute resize-none overflow-hidden bg-transparent outline-none"
          style={{
            left: textEditScreen.x,
            top: textEditScreen.y,
            minWidth: 200,
            minHeight: textEdit.fontSize * 1.5 * viewport.zoom,
            fontSize: textEdit.fontSize * viewport.zoom,
            lineHeight: 1.25,
            fontFamily: TEXT_FONT_FAMILY,
            color: textEdit.color,
            border: "1px dashed #6965db",
          }}
          value={textEdit.value}
          onChange={(e) =>
            setTextEdit((t) => (t ? { ...t, value: e.target.value } : t))
          }
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              commitTextEdit(textEdit);
            }
          }}
          onBlur={() => commitTextEdit(textEdit)}
        />
      )}
    </div>
  );
}
