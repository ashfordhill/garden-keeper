import { PlantIcon } from "../plants/PlantIcon";
import { resolveSeasonalForm } from "../plants/forms";
import type { PlantSpecies } from "../document/schema";

export function SpeciesThumb({
  species,
  size = 36,
}: {
  species: PlantSpecies;
  size?: number;
}) {
  const params = resolveSeasonalForm(species, null);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <PlantIcon
        archetype={species.archetype}
        params={params}
        seed={species.id.length * 97}
        size={size * 0.9}
      />
    </svg>
  );
}
