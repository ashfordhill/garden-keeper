/**
 * Right-panel hints while the plant tool is active (especially spray mats).
 */
import { useEditorStore } from "../document/store";
import { BUILTIN_SPECIES_BY_ID } from "../plants/catalog";
import { speciesUsesSpray } from "../plants/placement";

export function PlantToolPanel() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const activeSpeciesId = useEditorStore((s) => s.activeSpeciesId);
  const docSpecies = useEditorStore((s) => s.document.species);

  if (activeTool !== "plant") return null;

  const species =
    (activeSpeciesId &&
      (docSpecies[activeSpeciesId] ??
        BUILTIN_SPECIES_BY_ID.get(activeSpeciesId))) ||
    null;

  if (!species) {
    return (
      <div className="flex w-64 flex-col gap-2 rounded-lg border border-gk-line bg-gk-panel p-3 text-gk-ink shadow-md">
        <div className="text-sm font-semibold">Place plants</div>
        <p className="text-[11px] leading-snug text-gk-muted">
          Pick a species from Add on the left, then click the canvas.
        </p>
      </div>
    );
  }

  const spray = speciesUsesSpray(species.archetype);

  return (
    <div className="flex w-64 flex-col gap-2 rounded-lg border border-gk-line bg-gk-panel p-3 text-gk-ink shadow-md">
      <div className="text-sm font-semibold">{species.commonName}</div>
      {species.botanicalName && (
        <p className="text-[11px] italic text-gk-muted">{species.botanicalName}</p>
      )}
      <p className="text-[11px] leading-snug text-gk-muted">
        {spray
          ? "Spray to cover an area — click and drag. Release to merge into one groundcover patch (one undo). Right-click later to expand or shrink coverage."
          : "Click once to place a single plant. Drag to move after selecting."}
      </p>
      {spray && (
        <div className="rounded-md bg-gk-hover px-2 py-1.5 text-[11px] text-gk-ink">
          Groundcover spray mode
        </div>
      )}
    </div>
  );
}
