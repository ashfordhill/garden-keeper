/**
 * Renders the locked Ground layer under regular elements: clean site border,
 * material surfaces, optional original-photo overlay.
 */
import type { GroundLayer, SeasonPhase } from "../document/schema";
import { resolveMaterialStyle } from "./styles";

function surfacePath(
  ground: GroundLayer,
  points: { x: number; y: number }[],
): string {
  return points
    .map((p, i) => {
      const x = ground.x + p.x * ground.width;
      const y = ground.y + p.y * ground.height;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function GroundLayerView({
  ground,
  seasonPhase,
}: {
  ground: GroundLayer;
  seasonPhase: SeasonPhase | null;
}) {
  const base = resolveMaterialStyle("mulch", seasonPhase);

  return (
    <g data-ground-layer>
      {/* Site rectangle always filled — no "holes" to the canvas behind */}
      <rect
        x={ground.x}
        y={ground.y}
        width={ground.width}
        height={ground.height}
        fill={base.fillColor}
        stroke="var(--gk-muted)"
        strokeWidth={2}
      />

      {ground.surfaces.map((s) => {
        const style = resolveMaterialStyle(s.material, seasonPhase);
        const d = `${surfacePath(ground, s.points)} Z`;
        return (
          <path
            key={s.id}
            d={d}
            fill={style.fillColor}
            stroke={style.strokeColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        );
      })}

      {ground.overlay?.visible && ground.overlay.href && (
        <image
          href={ground.overlay.href}
          x={ground.x}
          y={ground.y}
          width={ground.width}
          height={ground.height}
          opacity={ground.overlay.opacity}
          preserveAspectRatio="none"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Outer border on top so the site reads as one square */}
      <rect
        x={ground.x}
        y={ground.y}
        width={ground.width}
        height={ground.height}
        fill="none"
        stroke="var(--gk-ink)"
        strokeWidth={2.5}
        opacity={0.55}
      />
    </g>
  );
}
