/**
 * Plant palette + garden inventory. Floating card matching the Toolbar style.
 */
import { useMemo, useState } from "react";
import type { Archetype } from "../document/schema";
import { useEditorStore, selectActiveView } from "../document/store";
import { SpeciesThumb } from "./SpeciesThumb";
import {
  ARCHETYPES,
  filterSpecies,
  groupPlacedPlants,
  mergeCatalog,
  type SpeciesFilter,
} from "./speciesFilters";

type Tab = "add" | "edit";

export function Sidebar() {
  const document = useEditorStore((s) => s.document);
  const view = useEditorStore(selectActiveView);
  const activeSpeciesId = useEditorStore((s) => s.activeSpeciesId);
  const setActiveSpeciesId = useEditorStore((s) => s.setActiveSpeciesId);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const upsertSpecies = useEditorStore((s) => s.upsertSpecies);

  const [tab, setTab] = useState<Tab>("add");
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [archetypes, setArchetypes] = useState<Set<Archetype>>(new Set());

  const catalog = useMemo(
    () => mergeCatalog(document.species),
    [document.species],
  );
  const filter: SpeciesFilter = { query, archetypes, tag: null };
  const filtered = useMemo(
    () => filterSpecies(catalog, filter),
    [catalog, query, archetypes],
  );

  const placed = view.elements.filter((el) => el.type === "plant");
  const groups = useMemo(
    () =>
      groupPlacedPlants(
        placed.map((el) => ({
          id: el.id,
          speciesId: el.type === "plant" ? el.speciesId : "",
        })),
        catalog,
      ).filter((g) => filterSpecies([g.species], filter).length > 0),
    [placed, catalog, query, archetypes],
  );

  function toggleArchetype(a: Archetype) {
    setArchetypes((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  function pickSpecies(id: string) {
    const species = catalog.find((s) => s.id === id);
    if (species) upsertSpecies(species);
    setActiveSpeciesId(id);
    setActiveTool("plant");
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="rounded-lg border border-gk-line bg-gk-panel px-3 py-1.5 text-sm shadow-md hover:bg-gk-hover"
        onClick={() => setCollapsed(false)}
        title="Show plants"
      >
        Plants
      </button>
    );
  }

  return (
    <div className="flex w-72 flex-col gap-2 rounded-lg border border-gk-line bg-gk-panel p-2 shadow-md">
      <div className="flex items-center gap-1">
        <div className="flex flex-1 rounded-md bg-gk-hover p-0.5 text-xs">
          {(
            [
              ["add", "Add"],
              ["edit", "Edit"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded px-2 py-1 ${
                tab === id
                  ? "bg-gk-panel font-medium shadow-sm"
                  : "text-gk-muted hover:text-gk-ink"
              }`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded px-1.5 py-1 text-gk-muted hover:bg-gk-hover hover:text-gk-ink"
          onClick={() => setCollapsed(true)}
          title="Collapse"
          aria-label="Collapse sidebar"
        >
          ×
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search plants…"
        className="w-full rounded-md border border-gk-line px-2 py-1 text-sm outline-none focus:border-neutral-400"
      />

      <div className="flex flex-wrap gap-1">
        {ARCHETYPES.map((a) => (
          <button
            key={a}
            type="button"
            className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${
              archetypes.has(a)
                ? "bg-gk-accent text-gk-panel"
                : "bg-gk-hover text-gk-muted hover:bg-gk-hover"
            }`}
            onClick={() => toggleArchetype(a)}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="max-h-[50vh] overflow-y-auto">
        {tab === "add" ? (
          <ul className="flex flex-col gap-0.5">
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-gk-hover ${
                    activeSpeciesId === s.id ? "bg-gk-hover ring-1 ring-gk-line" : ""
                  }`}
                  onClick={() => pickSpecies(s.id)}
                >
                  <SpeciesThumb species={s} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {s.commonName}
                    </span>
                    <span className="block truncate text-[11px] capitalize text-gk-muted">
                      {s.archetype}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-gk-muted">
                No plants match
              </li>
            )}
          </ul>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {groups.map((g) => (
              <li key={g.species.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-gk-hover"
                  onClick={() => setSelectedIds(g.elementIds)}
                >
                  <SpeciesThumb species={g.species} />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {g.species.commonName}
                  </span>
                  <span className="text-xs text-gk-muted">
                    ×{g.elementIds.length}
                  </span>
                </button>
              </li>
            ))}
            {groups.length === 0 && (
              <li className="px-2 py-4 text-center text-xs text-gk-muted">
                No plants placed yet — pick one from Add, then click the canvas
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
