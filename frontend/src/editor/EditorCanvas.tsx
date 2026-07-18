/**
 * OWNED BY AGENT A (Wave 2). Placeholder canvas: renders the active view's
 * elements read-only. Agent A replaces this with the full infinite SVG canvas
 * (pan/zoom, selection, transform handles, tools, hotkeys).
 */
import { useEditorStore, selectActiveView } from "../document/store";
import { PlantIcon } from "../plants/PlantIcon";
import { resolveSeasonalForm } from "../plants/forms";
import { BUILTIN_SPECIES_BY_ID } from "../plants/catalog";
import type { Element } from "../document/schema";

function ElementView({ element }: { element: Element }) {
  const doc = useEditorStore((s) => s.document);
  const seasonPhase = useEditorStore((s) => s.seasonPhase);
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const transform = `translate(${cx} ${cy}) rotate(${(element.angle * 180) / Math.PI})`;

  switch (element.type) {
    case "rect":
      return (
        <g transform={transform} opacity={element.opacity}>
          <rect
            x={-element.width / 2}
            y={-element.height / 2}
            width={element.width}
            height={element.height}
            fill={element.style.fillColor}
            stroke={element.style.strokeColor}
            strokeWidth={element.style.strokeWidth}
          />
        </g>
      );
    case "ellipse":
      return (
        <g transform={transform} opacity={element.opacity}>
          <ellipse
            rx={element.width / 2}
            ry={element.height / 2}
            fill={element.style.fillColor}
            stroke={element.style.strokeColor}
            strokeWidth={element.style.strokeWidth}
          />
        </g>
      );
    case "plant": {
      const species =
        doc.species[element.speciesId] ??
        BUILTIN_SPECIES_BY_ID.get(element.speciesId);
      if (!species) return null;
      return (
        <g transform={transform} opacity={element.opacity}>
          <PlantIcon
            archetype={species.archetype}
            params={resolveSeasonalForm(species, seasonPhase)}
            seed={element.seed}
            size={Math.min(element.width, element.height)}
          />
        </g>
      );
    }
    default:
      return null;
  }
}

export function EditorCanvas() {
  const view = useEditorStore(selectActiveView);
  return (
    <svg className="h-full w-full" data-testid="editor-canvas">
      {view.elements.map((el) => (
        <ElementView key={el.id} element={el} />
      ))}
    </svg>
  );
}
