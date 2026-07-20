/**
 * Compact controls for the locked Ground layer (replaces the old Photo panel).
 */
import { useEditorStore, selectActiveView } from "../document/store";
import { useImportStore } from "../import/importStore";

export function GroundPanel() {
  const view = useEditorStore(selectActiveView);
  const mutateDocument = useEditorStore((s) => s.mutateDocument);
  const openWizard = useImportStore((s) => s.openWizard);
  const ground = view.ground;

  function patchOverlay(
    patch: Partial<NonNullable<typeof ground>["overlay"]>,
  ) {
    if (!ground?.overlay) return;
    mutateDocument((doc) => ({
      ...doc,
      views: doc.views.map((v) =>
        v.id === doc.activeViewId && v.ground?.overlay
          ? {
              ...v,
              ground: {
                ...v.ground!,
                overlay: { ...v.ground!.overlay!, ...patch },
              },
            }
          : v,
      ),
    }));
  }

  function clearGround() {
    mutateDocument((doc) => ({
      ...doc,
      views: doc.views.map((v) =>
        v.id === doc.activeViewId ? { ...v, ground: undefined } : v,
      ),
    }));
  }

  return (
    <div className="flex w-64 flex-col gap-2 rounded-lg border border-gk-line bg-gk-panel p-2 text-gk-ink shadow-md">
      <div className="text-sm font-semibold">Ground</div>
      <p className="text-[11px] leading-snug text-gk-muted">
        Landscape background (grass / mulch / hardscape). Edit in the import
        wizard — plants go on top with the palette.
      </p>

      <button
        type="button"
        className="rounded-md bg-gk-accent px-2 py-1.5 text-sm font-medium text-gk-panel"
        onClick={openWizard}
      >
        {ground ? "Edit ground…" : "Import landscape…"}
      </button>

      {ground && (
        <>
          <p className="text-[11px] text-gk-muted">
            {ground.surfaces.length} surface
            {ground.surfaces.length === 1 ? "" : "s"}
            {view.scale
              ? ` · 1 unit ≈ ${view.scale.unitsPerCanvasUnit.toPrecision(3)} ${view.scale.unit}`
              : ""}
          </p>
          {ground.overlay && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ground.overlay.visible}
                onChange={(e) => patchOverlay({ visible: e.target.checked })}
              />
              Original photo overlay
            </label>
          )}
          {ground.overlay?.visible && (
            <label className="flex items-center gap-2 text-xs text-gk-muted">
              Opacity
              <input
                type="range"
                min={0.15}
                max={0.9}
                step={0.05}
                value={ground.overlay.opacity}
                onChange={(e) =>
                  patchOverlay({ opacity: Number(e.target.value) })
                }
              />
            </label>
          )}
          <button
            type="button"
            className="rounded-md border border-gk-line px-2 py-1 text-xs text-gk-danger hover:bg-gk-hover"
            onClick={clearGround}
          >
            Remove ground
          </button>
        </>
      )}
    </div>
  );
}
