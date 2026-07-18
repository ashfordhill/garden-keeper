/**
 * Renders one document element in canvas coordinates. All element types from
 * the schema are supported; rect/ellipse/polygon/freehand get the seeded
 * hand-drawn wobble from rough.ts.
 */
import { memo } from "react";
import type { Element, PlantSpecies, SeasonPhase } from "../document/schema";
import { PlantIcon } from "../plants/PlantIcon";
import { resolveSeasonalForm } from "../plants/forms";
import { BUILTIN_SPECIES_BY_ID } from "../plants/catalog";
import {
  roughEllipsePath,
  roughPolygonPath,
  roughRectPath,
  smoothOpenPath,
} from "./rough";

export const TEXT_FONT_FAMILY =
  "'Segoe Print', 'Comic Sans MS', cursive, system-ui";

function rotationTransform(el: Element): string | undefined {
  if (el.angle === 0) return undefined;
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return `rotate(${(el.angle * 180) / Math.PI} ${cx} ${cy})`;
}

export const ElementRenderer = memo(function ElementRenderer({
  element: el,
  species,
  seasonPhase,
}: {
  element: Element;
  /** Document species catalog (doc.species). */
  species: Record<string, PlantSpecies>;
  seasonPhase: SeasonPhase | null;
}) {
  const transform = rotationTransform(el);

  switch (el.type) {
    case "rect": {
      const d = roughRectPath(el.x, el.y, el.width, el.height, el.seed);
      return (
        <g transform={transform} opacity={el.opacity}>
          {el.style.fillColor !== "transparent" && (
            <rect
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              fill={el.style.fillColor}
            />
          )}
          <path
            d={d}
            fill="none"
            stroke={el.style.strokeColor}
            strokeWidth={el.style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "ellipse": {
      const d = roughEllipsePath(
        el.x + el.width / 2,
        el.y + el.height / 2,
        el.width / 2,
        el.height / 2,
        el.seed,
      );
      return (
        <g transform={transform} opacity={el.opacity}>
          <path
            d={d}
            fill={el.style.fillColor}
            stroke={el.style.strokeColor}
            strokeWidth={el.style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "polygon": {
      const abs = el.points.map((p) => ({
        x: el.x + p.x * el.width,
        y: el.y + p.y * el.height,
      }));
      const d = roughPolygonPath(abs, el.seed, Math.min(el.width, el.height));
      return (
        <g transform={transform} opacity={el.opacity}>
          <path
            d={d}
            fill={el.style.fillColor}
            stroke={el.style.strokeColor}
            strokeWidth={el.style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "freehand": {
      const abs = el.points.map((p) => ({
        x: el.x + p.x * el.width,
        y: el.y + p.y * el.height,
      }));
      return (
        <g transform={transform} opacity={el.opacity}>
          <path
            d={smoothOpenPath(abs)}
            fill="none"
            stroke={el.style.strokeColor}
            strokeWidth={el.style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "text": {
      const lines = el.text.split("\n");
      const lineHeight = el.fontSize * 1.25;
      return (
        <g transform={transform} opacity={el.opacity}>
          <text
            x={el.x}
            y={el.y}
            fill={el.color}
            fontSize={el.fontSize}
            fontFamily={TEXT_FONT_FAMILY}
            style={{ whiteSpace: "pre", userSelect: "none" }}
          >
            {lines.map((line, i) => (
              <tspan key={i} x={el.x} dy={i === 0 ? el.fontSize : lineHeight}>
                {line || " "}
              </tspan>
            ))}
          </text>
        </g>
      );
    }
    case "image": {
      if (!el.visible) return null;
      const opacity = el.opacity * (el.dimmed ? 0.4 : 1);
      return (
        <g transform={transform} opacity={opacity}>
          <image
            href={el.href}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            preserveAspectRatio="none"
          />
        </g>
      );
    }
    case "plant": {
      const sp =
        species[el.speciesId] ?? BUILTIN_SPECIES_BY_ID.get(el.speciesId);
      if (!sp) return null;
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      return (
        <g
          transform={`translate(${cx} ${cy}) rotate(${(el.angle * 180) / Math.PI})`}
          opacity={el.opacity}
        >
          <PlantIcon
            archetype={sp.archetype}
            params={resolveSeasonalForm(sp, seasonPhase)}
            seed={el.seed}
            size={Math.min(el.width, el.height)}
          />
          {el.showLabel && (
            <text
              y={el.height / 2 + 14}
              textAnchor="middle"
              fontSize={12}
              fill="#525252"
              style={{ userSelect: "none" }}
            >
              {el.label ?? sp.commonName}
            </text>
          )}
        </g>
      );
    }
  }
});
