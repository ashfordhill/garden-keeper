/**
 * Right-column inspector for a single selected plant: details + seasonal colors.
 */
import { useEffect, useState } from "react";
import type { PlantElement, SeasonPhase } from "../document/schema";
import { useEditorStore, selectActiveView } from "../document/store";
import { BUILTIN_SPECIES_BY_ID } from "../plants/catalog";
import { resolveSeasonalForm } from "../plants/forms";

const SEASON_SWATCHES: { label: string; phase: SeasonPhase }[] = [
  { label: "Spring", phase: "mid-spring" },
  { label: "Summer", phase: "mid-summer" },
  { label: "Fall", phase: "mid-fall" },
  { label: "Winter", phase: "winter" },
];

/** Align with PlantIcon: bare canopy below this volume. */
const FOLIAGE_PRESENT = 0.04;
/** Align with PlantIcon: no bloom glyphs at or below this density. */
const BLOOM_PRESENT = 0.02;

function SeasonColorHalf({
  present,
  color,
  kind,
}: {
  present: boolean;
  color: string;
  kind: "foliage" | "bloom";
}) {
  if (!present) {
    return (
      <span
        className="relative flex h-full w-1/2 items-center justify-center bg-gk-hover text-[11px] font-semibold leading-none text-gk-muted"
        aria-label={`${kind} none`}
        title={`${kind}: none`}
      >
        ×
      </span>
    );
  }
  return (
    <span
      className="h-full w-1/2"
      style={{ background: color }}
      aria-label={kind}
      title={`${kind}: ${color}`}
    />
  );
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatTags(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

export function SelectionPanel() {
  const view = useEditorStore(selectActiveView);
  const document = useEditorStore((s) => s.document);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const updateElements = useEditorStore((s) => s.updateElements);

  const selected =
    selectedIds.length === 1
      ? view.elements.find((el) => el.id === selectedIds[0])
      : undefined;
  const plant = selected?.type === "plant" ? selected : undefined;

  const [tagsDraft, setTagsDraft] = useState("");
  useEffect(() => {
    setTagsDraft(formatTags(plant?.tags));
  }, [plant?.id, plant?.tags]);

  // Idle / multi-select / non-plant: hide — draw tools use ToolOptionsPanel.
  if (!plant) return null;

  const plantId = plant.id;
  const species =
    document.species[plant.speciesId] ??
    BUILTIN_SPECIES_BY_ID.get(plant.speciesId);

  function patchPlant(patch: Partial<PlantElement>) {
    updateElements([plantId], (el) =>
      el.type === "plant" ? { ...el, ...patch } : el,
    );
  }

  function commitTags(raw: string) {
    const tags = parseTags(raw);
    patchPlant({ tags: tags.length > 0 ? tags : undefined });
    setTagsDraft(formatTags(tags));
  }

  return (
    <div className="flex w-64 flex-col gap-2 rounded-lg border border-gk-line bg-gk-panel p-2 text-gk-ink shadow-md">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">
          {species?.commonName ?? "Unknown species"}
        </div>
        {species?.botanicalName && (
          <div className="truncate text-[11px] italic text-gk-muted">
            {species.botanicalName}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-0.5 text-[11px] text-gk-muted">
        Custom name
        <input
          type="text"
          value={plant.label ?? ""}
          onChange={(e) =>
            patchPlant({ label: e.target.value || undefined })
          }
          placeholder="Nickname"
          className="rounded-md border border-gk-line px-2 py-1 text-sm text-gk-ink outline-none focus:border-neutral-400"
        />
      </label>

      <label className="flex flex-col gap-0.5 text-[11px] text-gk-muted">
        Notes
        <textarea
          value={plant.notes ?? ""}
          onChange={(e) =>
            patchPlant({ notes: e.target.value || undefined })
          }
          rows={3}
          placeholder="Description…"
          className="resize-y rounded-md border border-gk-line px-2 py-1 text-sm text-gk-ink outline-none focus:border-neutral-400"
        />
      </label>

      <label className="flex flex-col gap-0.5 text-[11px] text-gk-muted">
        Tags
        <input
          type="text"
          value={tagsDraft}
          onChange={(e) => setTagsDraft(e.target.value)}
          onBlur={(e) => commitTags(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder="comma, separated"
          className="rounded-md border border-gk-line px-2 py-1 text-sm text-gk-ink outline-none focus:border-neutral-400"
        />
      </label>

      <label className="flex flex-col gap-0.5 text-[11px] text-gk-muted">
        Planted
        <input
          type="date"
          value={plant.plantedAt ?? ""}
          onChange={(e) =>
            patchPlant({ plantedAt: e.target.value || undefined })
          }
          className="rounded-md border border-gk-line px-2 py-1 text-sm text-gk-ink outline-none focus:border-neutral-400"
        />
      </label>

      {species && (
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-gk-muted">Seasonal colors</div>
          <div className="grid grid-cols-4 gap-1">
            {SEASON_SWATCHES.map(({ label, phase }) => {
              const form = resolveSeasonalForm(species, phase);
              const hasFoliage = form.foliage.volume > FOLIAGE_PRESENT;
              const hasBloom = form.bloom.density > BLOOM_PRESENT;
              const foliageLabel = hasFoliage ? form.foliage.color : "none";
              const bloomLabel = hasBloom ? form.bloom.color : "none";
              return (
                <div
                  key={phase}
                  className="flex flex-col items-center gap-0.5"
                  title={`${label}: foliage ${foliageLabel}, bloom ${bloomLabel}`}
                >
                  <div className="flex h-5 w-full overflow-hidden rounded border border-gk-line">
                    <SeasonColorHalf
                      present={hasFoliage}
                      color={form.foliage.color}
                      kind="foliage"
                    />
                    <SeasonColorHalf
                      present={hasBloom}
                      color={form.bloom.color}
                      kind="bloom"
                    />
                  </div>
                  <span className="text-[10px] text-gk-muted">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
