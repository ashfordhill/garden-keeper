/**
 * Pure helpers for the plant palette / garden inventory filters.
 */
import type { Archetype, PlantSpecies } from "../document/schema";
import { BUILTIN_SPECIES } from "../plants/catalog";

export const ARCHETYPES: Archetype[] = [
  "tree",
  "shrub",
  "grass",
  "flower",
  "succulent",
  "groundcover",
  "vine",
];

/** Merge built-in catalog with document overrides (document wins). */
export function mergeCatalog(
  documentSpecies: Record<string, PlantSpecies>,
): PlantSpecies[] {
  const byId = new Map(BUILTIN_SPECIES.map((s) => [s.id, s]));
  for (const s of Object.values(documentSpecies)) {
    byId.set(s.id, s);
  }
  return [...byId.values()].sort((a, b) =>
    a.commonName.localeCompare(b.commonName),
  );
}

export interface SpeciesFilter {
  query: string;
  archetypes: Set<Archetype>;
  tag: string | null;
}

export function filterSpecies(
  species: PlantSpecies[],
  filter: SpeciesFilter,
): PlantSpecies[] {
  const q = filter.query.trim().toLowerCase();
  return species.filter((s) => {
    if (filter.archetypes.size > 0 && !filter.archetypes.has(s.archetype)) {
      return false;
    }
    if (filter.tag && !s.tags.includes(filter.tag)) return false;
    if (!q) return true;
    return (
      s.commonName.toLowerCase().includes(q) ||
      (s.botanicalName?.toLowerCase().includes(q) ?? false) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function allTags(species: PlantSpecies[]): string[] {
  const tags = new Set<string>();
  for (const s of species) for (const t of s.tags) tags.add(t);
  return [...tags].sort();
}

export interface PlantGroup {
  species: PlantSpecies;
  elementIds: string[];
}

export function groupPlacedPlants(
  plants: { id: string; speciesId: string }[],
  catalog: PlantSpecies[],
): PlantGroup[] {
  const bySpecies = new Map<string, string[]>();
  for (const p of plants) {
    const list = bySpecies.get(p.speciesId) ?? [];
    list.push(p.id);
    bySpecies.set(p.speciesId, list);
  }
  const catalogById = new Map(catalog.map((s) => [s.id, s]));
  const groups: PlantGroup[] = [];
  for (const [speciesId, elementIds] of bySpecies) {
    const species = catalogById.get(speciesId);
    if (!species) continue;
    groups.push({ species, elementIds });
  }
  return groups.sort((a, b) =>
    a.species.commonName.localeCompare(b.species.commonName),
  );
}
