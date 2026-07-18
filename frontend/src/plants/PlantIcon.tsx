/**
 * FROZEN CONTRACT (Wave 1): the parametric plant icon renderer.
 *
 * Agent B replaces the internals with the real cartoon renderer (foliage /
 * bloom / branching driven by VisualParams, seeded hand-drawn wobble) but the
 * component signature and rendering conventions below must not change:
 *
 * - Renders a single SVG <g> element, centered at the origin.
 * - The icon fits within the box [-size/2, -size/2] .. [size/2, size/2].
 * - Output is deterministic for a given (archetype, params, seed, size).
 * - Pure SVG primitives only (paths, circles, ellipses) — no <image>, no
 *   filters that break SVG export.
 */
import type { Archetype, VisualParams } from "../document/schema";

export interface PlantIconProps {
  archetype: Archetype;
  params: VisualParams;
  /** Deterministic wobble seed (comes from the PlantElement). */
  seed: number;
  /** Icon box size in canvas units. */
  size: number;
}

/** Placeholder renderer: foliage disc + bloom dots. Replaced by Agent B. */
export function PlantIcon({ params, seed, size }: PlantIconProps) {
  const r = size / 2;
  const bloomCount = Math.round(params.bloom.density * 5);
  const bloomDots = Array.from({ length: bloomCount }, (_, i) => {
    const angle = ((seed % 7) + i * 2.4) % (Math.PI * 2);
    const dist = r * 0.55;
    return (
      <circle
        key={i}
        cx={Math.cos(angle) * dist}
        cy={Math.sin(angle) * dist}
        r={r * 0.12}
        fill={params.bloom.color}
      />
    );
  });
  return (
    <g>
      <circle
        r={r * (0.5 + 0.5 * params.foliage.volume)}
        fill={params.foliage.color}
        stroke={params.branching.color}
        strokeWidth={size * 0.03}
      />
      {bloomDots}
    </g>
  );
}
