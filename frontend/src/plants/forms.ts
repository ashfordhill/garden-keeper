/**
 * Seasonal form resolution: species define a sparse map of phase -> form;
 * a missing phase resolves to the nearest defined phase (cyclic distance
 * through the year), so a species with only "mid-summer" defined still
 * renders in every season.
 */
import {
  SEASON_PHASES,
  type PlantSpecies,
  type SeasonPhase,
  type VisualParams,
} from "../document/schema";

const PHASE_INDEX = new Map(SEASON_PHASES.map((p, i) => [p, i]));

function cyclicDistance(a: SeasonPhase, b: SeasonPhase): number {
  const n = SEASON_PHASES.length;
  const d = Math.abs(PHASE_INDEX.get(a)! - PHASE_INDEX.get(b)!);
  return Math.min(d, n - d);
}

/**
 * Returns the visual form of `species` for `phase`, or its display form when
 * `phase` is null (default display mode).
 */
export function resolveSeasonalForm(
  species: PlantSpecies,
  phase: SeasonPhase | null,
): VisualParams {
  const target = phase ?? species.displayPhase;
  const defined = Object.keys(species.forms) as SeasonPhase[];
  if (defined.length === 0) {
    throw new Error(`Species ${species.id} has no seasonal forms`);
  }
  const exact = species.forms[target];
  if (exact) return exact;
  let best = defined[0];
  for (const candidate of defined) {
    if (cyclicDistance(candidate, target) < cyclicDistance(best, target)) {
      best = candidate;
    }
  }
  return species.forms[best]!;
}
