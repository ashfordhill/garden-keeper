/**
 * Compact pizza-wheel picker for stone path / hardscape variants.
 */
import { STONE_VARIANTS, type StoneVariant } from "../landscape/drawTools";

const SIZE = 132;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER = 58;
const INNER = 18;

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function donutSlice(
  index: number,
  total: number,
): string {
  const start = (index / total) * Math.PI * 2 - Math.PI / 2;
  const end = ((index + 1) / total) * Math.PI * 2 - Math.PI / 2;
  const p0 = polar(CX, CY, OUTER, start);
  const p1 = polar(CX, CY, OUTER, end);
  const p2 = polar(CX, CY, INNER, end);
  const p3 = polar(CX, CY, INNER, start);
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${p3.x} ${p3.y}`,
    "Z",
  ].join(" ");
}

function labelPos(index: number, total: number) {
  const mid =
    ((index + 0.5) / total) * Math.PI * 2 - Math.PI / 2;
  return polar(CX, CY, (OUTER + INNER) / 2, mid);
}

export function StoneVariantWheel({
  value,
  onChange,
}: {
  value: StoneVariant;
  onChange: (v: StoneVariant) => void;
}) {
  const n = STONE_VARIANTS.length;

  return (
    <div
      className="rounded-full border border-gk-line bg-gk-panel p-1 shadow-lg"
      role="listbox"
      aria-label="Stone type"
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {STONE_VARIANTS.map((v, i) => {
          const active = v.id === value;
          const mid = labelPos(i, n);
          return (
            <g key={v.id}>
              <path
                d={donutSlice(i, n)}
                fill={v.fillColor}
                stroke={active ? "var(--gk-accent)" : "var(--gk-line)"}
                strokeWidth={active ? 2.5 : 1}
                className="cursor-pointer"
                role="option"
                aria-selected={active}
                onClick={() => onChange(v.id)}
              >
                <title>{v.label}</title>
              </path>
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="pointer-events-none select-none fill-gk-ink"
                style={{ fontSize: 9, fontWeight: active ? 600 : 500 }}
              >
                {v.label.slice(0, 4)}
              </text>
            </g>
          );
        })}
        <circle
          cx={CX}
          cy={CY}
          r={INNER - 1}
          fill="var(--gk-panel)"
          stroke="var(--gk-line)"
        />
      </svg>
    </div>
  );
}
