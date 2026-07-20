/**
 * Landscape import wizard (modal) — keeps photo work off the main canvas.
 *
 * Steps:
 *  1. Upload
 *  2. Mark 4 corners → axis-aligned crop (no warp / dimensions)
 *  3. Paint-refine materials (wizard-internal surfaces)
 *  4. Apply → editable polygons + dimmed crop photo on the active view
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LandscapeMaterial, LandscapeSurface } from "../document/schema";
import { useEditorStore } from "../document/store";
import { useViewportStore } from "../editor/viewportStore";
import { screenToCanvas } from "../editor/viewport";
import {
  LABEL_COLORS,
  MATERIAL_STYLES,
  SWATCH_COLORS,
} from "../landscape/styles";
import {
  extractLayout,
  photoUrl,
  rectifyPhoto,
  uploadPhoto,
} from "../photo/api";
import {
  buildSurfacesFromLabels,
  fitSiteBox,
  regionToSurface,
  surfacesToCanvasElements,
} from "../photo/blueprint";
import { useImportStore } from "./importStore";

const CORNER_LABELS = [
  "Top-left",
  "Top-right",
  "Bottom-right",
  "Bottom-left",
] as const;

const BRUSH_RAIL: { material: LandscapeMaterial; label: string }[] = [
  { material: "grass", label: "Grass" },
  { material: "mulch", label: "Mulch" },
  { material: "hardscape", label: "Stone" },
];

/** Discrete artistic brush sizes (CSS px diameter on the paint canvas). */
const BRUSH_SIZE_PRESETS = [
  { id: "S", label: "S", size: 16 },
  { id: "M", label: "M", size: 28 },
  { id: "L", label: "L", size: 44 },
  { id: "XL", label: "XL", size: 64 },
] as const;

/** Blue accent for the active material tool (not garden green). */
const BRUSH_SELECTED =
  "bg-sky-100 font-medium text-sky-900 ring-1 ring-sky-500 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-400";

type Step = "upload" | "corners" | "refine";

type CanvasSnap = { label: ImageData; stroke: ImageData };

export function ImportWizard() {
  const open = useImportStore((s) => s.open);
  const closeWizard = useImportStore((s) => s.closeWizard);
  const mutateDocument = useEditorStore((s) => s.mutateDocument);
  const viewport = useViewportStore((s) => s.viewport);

  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [corners, setCorners] = useState<{ x: number; y: number }[]>([]);

  const [cropId, setCropId] = useState<string | null>(null);
  const [cropSize, setCropSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [surfaces, setSurfaces] = useState<LandscapeSurface[]>([]);

  const [brush, setBrush] = useState<LandscapeMaterial>("mulch");
  const [brushSize, setBrushSize] = useState<number>(
    BRUSH_SIZE_PRESETS[1].size,
  );
  const [showOverlay, setShowOverlay] = useState(true);
  /** True after at least one brush stroke in this refine session. */
  const [hasPainted, setHasPainted] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  /** Brush cursor preview in paint-canvas display coords. */
  const [cursorPos, setCursorPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const labelRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const undoStack = useRef<CanvasSnap[]>([]);

  function reset() {
    setStep("upload");
    setBusy(false);
    setStatus(null);
    setError(null);
    setSourceId(null);
    setSourceSize(null);
    setCorners([]);
    setCropId(null);
    setCropSize(null);
    setSurfaces([]);
    setHasPainted(false);
    setCanUndo(false);
    undoStack.current = [];
  }

  useEffect(() => {
    if (open) reset();
  }, [open]);

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    setStatus("Uploading…");
    try {
      const up = await uploadPhoto(file);
      setSourceId(up.imageId);
      setSourceSize({ width: up.width, height: up.height });
      setCorners([]);
      setStep("corners");
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function clickCorner(
    e: React.MouseEvent<HTMLDivElement>,
    displayW: number,
    displayH: number,
  ) {
    if (!sourceSize || corners.length >= 4 || busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / displayW) * sourceSize.width;
    const y = ((e.clientY - rect.top) / displayH) * sourceSize.height;
    setCorners((c) => [...c, { x, y }]);
  }

  async function runFirstPass() {
    if (!sourceId || corners.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      setStatus("Cropping…");
      const crop = await rectifyPhoto(sourceId, {
        corners: corners.map((c) => [c.x, c.y] as [number, number]),
      });
      setCropId(crop.imageId);
      setCropSize({ width: crop.width, height: crop.height });

      setStatus("Reading grass, mulch & hardscape…");
      const layout = await extractLayout(crop.imageId);
      const photo = { width: crop.width, height: crop.height };
      setSurfaces(layout.regions.map((r) => regionToSurface(r, photo)));
      setStep("refine");
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const syncPaintSize = useCallback(() => {
    if (!cropSize) return;
    for (const canvas of [labelRef.current, strokeRef.current]) {
      if (!canvas) continue;
      if (
        canvas.width !== cropSize.width ||
        canvas.height !== cropSize.height
      ) {
        canvas.width = cropSize.width;
        canvas.height = cropSize.height;
      }
    }
  }, [cropSize]);

  useEffect(() => {
    if (step === "refine") syncPaintSize();
  }, [step, syncPaintSize, surfaces]);

  function captureSnapshot(): CanvasSnap | null {
    const label = labelRef.current;
    const stroke = strokeRef.current;
    if (!label || !stroke) return null;
    const lctx = label.getContext("2d")!;
    const sctx = stroke.getContext("2d")!;
    return {
      label: lctx.getImageData(0, 0, label.width, label.height),
      stroke: sctx.getImageData(0, 0, stroke.width, stroke.height),
    };
  }

  function restoreSnapshot(snap: CanvasSnap) {
    const label = labelRef.current;
    const stroke = strokeRef.current;
    if (!label || !stroke) return;
    label.getContext("2d")!.putImageData(snap.label, 0, 0);
    stroke.getContext("2d")!.putImageData(snap.stroke, 0, 0);
  }

  function pushSnapshot() {
    const snap = captureSnapshot();
    if (!snap) return;
    undoStack.current.push(snap);
    setCanUndo(undoStack.current.length > 1);
  }

  function undoStroke() {
    if (undoStack.current.length <= 1) return;
    undoStack.current.pop();
    const prev = undoStack.current[undoStack.current.length - 1];
    if (prev) restoreSnapshot(prev);
    setCanUndo(undoStack.current.length > 1);
    setHasPainted(undoStack.current.length > 1);
  }

  function paintAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const label = labelRef.current;
    const stroke = strokeRef.current;
    if (!label || !stroke || !cropSize) return;
    const rect = stroke.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * stroke.width;
    const y = ((e.clientY - rect.top) / rect.height) * stroke.height;
    const radius = brushSize * (stroke.width / rect.width) * 0.5;

    const labelCtx = label.getContext("2d")!;
    labelCtx.fillStyle = LABEL_COLORS[brush];
    labelCtx.beginPath();
    labelCtx.arc(x, y, radius, 0, Math.PI * 2);
    labelCtx.fill();

    const strokeCtx = stroke.getContext("2d")!;
    strokeCtx.fillStyle = SWATCH_COLORS[brush];
    strokeCtx.beginPath();
    strokeCtx.arc(x, y, radius, 0, Math.PI * 2);
    strokeCtx.fill();
    setHasPainted(true);
  }

  /** Seed the hidden label mask; clear the visible stroke overlay. */
  function seedPaintFromSurfaces(list: LandscapeSurface[]) {
    const label = labelRef.current;
    const stroke = strokeRef.current;
    if (!label || !cropSize) return;
    syncPaintSize();
    const ctx = label.getContext("2d")!;
    ctx.fillStyle = LABEL_COLORS.mulch;
    ctx.fillRect(0, 0, label.width, label.height);
    for (const s of list) {
      ctx.fillStyle = LABEL_COLORS[s.material];
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const x = p.x * label.width;
        const y = p.y * label.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
    if (stroke) {
      const sctx = stroke.getContext("2d")!;
      sctx.clearRect(0, 0, stroke.width, stroke.height);
    }
    setHasPainted(false);
    undoStack.current = [];
    pushSnapshot();
  }

  async function rebuildFromPaint(): Promise<LandscapeSurface[] | null> {
    if (!cropId || !cropSize || !labelRef.current) return null;
    if (!hasPainted) {
      return surfaces;
    }
    setBusy(true);
    setError(null);
    setStatus("Updating surfaces…");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        labelRef.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("empty paint"))),
          "image/png",
        );
      });
      const next = await buildSurfacesFromLabels(cropId, blob, cropSize);
      if (next.length === 0) {
        throw new Error(
          "No surfaces came back from your labels — try painting larger areas.",
        );
      }
      setSurfaces(next);
      requestAnimationFrame(() => {
        seedPaintFromSurfaces(next);
      });
      setStatus(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (step === "refine" && surfaces.length) {
      requestAnimationFrame(() => seedPaintFromSurfaces(surfaces));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, cropId]);

  async function applyToCanvas() {
    if (!cropId || !cropSize) return;
    let finalSurfaces = surfaces;
    if (hasPainted) {
      const rebuilt = await rebuildFromPaint();
      if (!rebuilt) return;
      finalSurfaces = rebuilt;
    }
    const center = screenToCanvas(viewport, {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const siteBox = fitSiteBox(cropSize, center);
    const imported = surfacesToCanvasElements({
      surfaces: finalSurfaces,
      photo: cropSize,
      siteBox,
      overlayHref: photoUrl(cropId),
      overlayImageId: cropId,
    });

    mutateDocument((doc) => ({
      ...doc,
      views: doc.views.map((v) =>
        v.id === doc.activeViewId
          ? {
              ...v,
              // Shapes at the back (under plants); do not write ground.
              elements: [...imported, ...v.elements],
            }
          : v,
      ),
    }));
    closeWizard();
  }

  if (!open) return null;

  const sourceHref = sourceId ? photoUrl(sourceId) : null;
  const cropHref = cropId ? photoUrl(cropId) : null;

  const cornerDisplay = (() => {
    if (!sourceSize) return { w: 480, h: 360 };
    const maxW = Math.min(560, window.innerWidth - 80);
    const maxH = Math.min(420, window.innerHeight - 220);
    const s = Math.min(maxW / sourceSize.width, maxH / sourceSize.height);
    return { w: sourceSize.width * s, h: sourceSize.height * s };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border border-gk-line bg-gk-panel text-gk-ink shadow-2xl ${
          step === "refine" ? "max-w-5xl" : "max-w-3xl"
        }`}
      >
        <header className="flex items-center justify-between border-b border-gk-line px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gk-accent">
              Import landscape
            </p>
            <p className="text-sm text-gk-muted">
              {step === "upload" && "Upload a photo"}
              {step === "corners" && "Mark the yard corners"}
              {step === "refine" && "Refine materials"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-gk-muted hover:bg-gk-hover"
            onClick={closeWizard}
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <p className="mb-3 rounded-lg bg-gk-danger/15 px-3 py-2 text-sm text-gk-danger">
              {error}
            </p>
          )}
          {status && (
            <p className="mb-3 text-sm font-medium text-gk-accent">{status}</p>
          )}

          {step === "upload" && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gk-line bg-gk-canvas px-6 py-16 hover:border-gk-accent">
              <span className="text-sm font-medium">
                {busy ? "Uploading…" : "Choose a landscape photo"}
              </span>
              <span className="text-xs text-gk-muted">
                Taken from above / a window works best
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </label>
          )}

          {step === "corners" && sourceHref && sourceSize && (
            <div className="flex flex-col gap-3">
              <ol className="grid grid-cols-4 gap-1 text-[11px]">
                {CORNER_LABELS.map((label, i) => (
                  <li
                    key={label}
                    className={`rounded-md px-1.5 py-1 text-center ${
                      i < corners.length
                        ? "bg-gk-accent text-gk-panel"
                        : i === corners.length
                          ? "bg-gk-accent-soft font-medium"
                          : "bg-gk-hover text-gk-muted"
                    }`}
                  >
                    {i + 1}. {label}
                  </li>
                ))}
              </ol>

              <div
                className="relative mx-auto cursor-crosshair overflow-hidden rounded-lg border border-gk-line"
                style={{ width: cornerDisplay.w, height: cornerDisplay.h }}
                onClick={(e) =>
                  clickCorner(e, cornerDisplay.w, cornerDisplay.h)
                }
              >
                <img
                  src={sourceHref}
                  alt="Landscape"
                  className="h-full w-full object-fill"
                  draggable={false}
                />
                {corners.length >= 2 && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full">
                    <polyline
                      fill={
                        corners.length === 4
                          ? "rgba(76,175,80,0.15)"
                          : "none"
                      }
                      stroke="var(--gk-accent)"
                      strokeWidth={2}
                      points={[
                        ...corners.map((c) => {
                          const sx =
                            (c.x / sourceSize.width) * cornerDisplay.w;
                          const sy =
                            (c.y / sourceSize.height) * cornerDisplay.h;
                          return `${sx},${sy}`;
                        }),
                        ...(corners.length === 4
                          ? [
                              `${(corners[0].x / sourceSize.width) * cornerDisplay.w},${(corners[0].y / sourceSize.height) * cornerDisplay.h}`,
                            ]
                          : []),
                      ].join(" ")}
                    />
                  </svg>
                )}
                {corners.map((c, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gk-accent text-[11px] font-bold text-gk-panel"
                    style={{
                      left: (c.x / sourceSize.width) * cornerDisplay.w,
                      top: (c.y / sourceSize.height) * cornerDisplay.h,
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-gk-line px-3 py-1.5 text-sm hover:bg-gk-hover disabled:opacity-40"
                  disabled={corners.length === 0}
                  onClick={() => setCorners((c) => c.slice(0, -1))}
                >
                  Undo last corner
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gk-line px-3 py-1.5 text-sm hover:bg-gk-hover"
                  onClick={() => setCorners([])}
                >
                  Clear all
                </button>
                {corners.length === 4 && (
                  <button
                    type="button"
                    className="ml-auto rounded-lg bg-gk-accent px-4 py-2 text-sm font-medium text-gk-panel disabled:opacity-40"
                    disabled={busy}
                    onClick={() => void runFirstPass()}
                  >
                    {busy ? "Working…" : "Crop & continue"}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "refine" && cropHref && cropSize && (
            <div className="flex gap-3">
              {/* Left tool rail */}
              <aside className="flex w-32 shrink-0 flex-col gap-3 border-r border-gk-line pr-3">
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gk-muted">
                    Material
                  </p>
                  {BRUSH_RAIL.map(({ material, label }) => (
                    <button
                      key={material}
                      type="button"
                      title={label}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs ${
                        brush === material
                          ? BRUSH_SELECTED
                          : "hover:bg-gk-hover"
                      }`}
                      onClick={() => setBrush(material)}
                    >
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm"
                        style={{ background: SWATCH_COLORS[material] }}
                      />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gk-muted">
                    Brush size
                  </p>
                  <div className="flex items-center justify-between gap-1 px-0.5 py-1">
                    {BRUSH_SIZE_PRESETS.map((preset) => {
                      const selected = brushSize === preset.size;
                      const swatch = SWATCH_COLORS[brush];
                      // Visual diameter scales with preset; keep hit targets comfortable.
                      const dial = 8 + (preset.size / 64) * 18;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          title={`Brush ${preset.label} (${preset.size}px)`}
                          aria-label={`Brush size ${preset.label}`}
                          aria-pressed={selected}
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                            selected
                              ? "ring-1 ring-sky-500 dark:ring-sky-400"
                              : "hover:bg-gk-hover"
                          }`}
                          onClick={() => setBrushSize(preset.size)}
                        >
                          <span
                            className="rounded-full"
                            style={{
                              width: dial,
                              height: dial,
                              background: swatch,
                              boxShadow: selected
                                ? `0 0 0 2px ${swatch}55`
                                : undefined,
                              opacity: selected ? 1 : 0.72,
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-gk-muted">
                  <input
                    type="checkbox"
                    checked={showOverlay}
                    onChange={(e) => setShowOverlay(e.target.checked)}
                  />
                  Overlay
                </label>
              </aside>

              {/* Center preview */}
              <div
                className="relative mx-auto min-w-0 flex-1 overflow-hidden rounded-lg border border-gk-line"
                style={{
                  aspectRatio: `${cropSize.width} / ${cropSize.height}`,
                  maxWidth: "min(100%, 640px)",
                }}
              >
                <img
                  src={cropHref}
                  alt="Crop"
                  className="absolute inset-0 h-full w-full object-fill"
                  style={{ opacity: showOverlay ? 0.45 : 0.08 }}
                  onLoad={() => {
                    syncPaintSize();
                    seedPaintFromSurfaces(surfaces);
                  }}
                  draggable={false}
                />
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox={`0 0 ${cropSize.width} ${cropSize.height}`}
                  preserveAspectRatio="none"
                >
                  <rect
                    width={cropSize.width}
                    height={cropSize.height}
                    fill={MATERIAL_STYLES.mulch.fillColor}
                  />
                  {surfaces.map((s) => {
                    const d =
                      s.points
                        .map((p, i) => {
                          const x = p.x * cropSize.width;
                          const y = p.y * cropSize.height;
                          return `${i === 0 ? "M" : "L"}${x},${y}`;
                        })
                        .join(" ") + " Z";
                    return (
                      <path
                        key={s.id}
                        d={d}
                        fill={MATERIAL_STYLES[s.material].fillColor}
                        stroke={MATERIAL_STYLES[s.material].strokeColor}
                        strokeWidth={2}
                      />
                    );
                  })}
                </svg>
                <canvas ref={labelRef} className="hidden" aria-hidden />
                <canvas
                  ref={strokeRef}
                  className="absolute inset-0 h-full w-full touch-none"
                  style={{ opacity: 0.85, cursor: "none" }}
                  onPointerDown={(e) => {
                    painting.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCursorPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                    paintAt(e);
                  }}
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCursorPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                    if (painting.current) paintAt(e);
                  }}
                  onPointerLeave={() => {
                    if (!painting.current) setCursorPos(null);
                  }}
                  onPointerUp={() => {
                    if (painting.current) {
                      painting.current = false;
                      pushSnapshot();
                    }
                  }}
                />
                {cursorPos && (
                  <div
                    className="pointer-events-none absolute rounded-full border-2 border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                    style={{
                      left: cursorPos.x,
                      top: cursorPos.y,
                      width: brushSize,
                      height: brushSize,
                      marginLeft: -brushSize / 2,
                      marginTop: -brushSize / 2,
                      background: SWATCH_COLORS[brush],
                      opacity: 0.55,
                    }}
                    aria-hidden
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-gk-line px-4 py-3">
          {step === "refine" && (
            <>
              <button
                type="button"
                className="rounded-lg border border-gk-line px-3 py-1.5 text-sm hover:bg-gk-hover disabled:opacity-40"
                disabled={!canUndo || busy}
                onClick={undoStroke}
              >
                Undo
              </button>
              <button
                type="button"
                className="rounded-lg border border-gk-line px-3 py-1.5 text-sm hover:bg-gk-hover disabled:opacity-40"
                disabled={busy}
                onClick={() => seedPaintFromSurfaces(surfaces)}
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-lg border border-gk-line px-3 py-1.5 text-sm hover:bg-gk-hover"
                disabled={busy}
                onClick={() => setStep("corners")}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg border border-sky-500 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-40 dark:text-sky-300 dark:hover:bg-sky-950/40"
                disabled={busy || !hasPainted || !cropId}
                onClick={() => void rebuildFromPaint()}
              >
                {busy ? "Working…" : "Rebuild from paint"}
              </button>
              <button
                type="button"
                className="rounded-lg bg-gk-accent px-4 py-2 text-sm font-medium text-gk-panel disabled:opacity-40"
                disabled={busy || !cropId}
                onClick={() => void applyToCanvas()}
              >
                {busy ? "Working…" : "Apply to plan"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
