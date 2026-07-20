/**
 * Right-panel options while a landscape draw tool is active.
 */
import { useEditorStore } from "../document/store";
import {
  isLandscapeDrawTool,
  resolveDrawAppearance,
  STONE_VARIANTS,
  toolUsesStoneVariants,
} from "../landscape/drawTools";
import { StoneVariantWheel } from "./StoneVariantWheel";

const TOOL_TITLES: Record<string, string> = {
  stonePath: "Stone path",
  grassPath: "Grass path",
  mulchBed: "Mulch bed",
  hardscape: "Hardscape",
};

export function ToolOptionsPanel() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const stoneVariant = useEditorStore((s) => s.stoneVariant);
  const setStoneVariant = useEditorStore((s) => s.setStoneVariant);

  if (!isLandscapeDrawTool(activeTool)) return null;

  const appearance = resolveDrawAppearance(activeTool, stoneVariant);
  const usesStone = toolUsesStoneVariants(activeTool);

  return (
    <div className="flex w-64 flex-col gap-3 rounded-lg border border-gk-line bg-gk-panel p-3 text-gk-ink shadow-md">
      <div>
        <div className="text-sm font-semibold">
          {TOOL_TITLES[activeTool] ?? "Draw"}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-gk-muted">
          Click to place vertices. Double-click or Enter to close the shape.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="h-8 w-8 shrink-0 rounded-md border border-gk-line"
          style={{ background: appearance.style.fillColor }}
          title="Fill"
        />
        <div className="min-w-0 text-[11px] text-gk-muted">
          <div className="truncate text-sm text-gk-ink">{appearance.label}</div>
          <div>
            Stroke {appearance.style.strokeWidth}px · {appearance.role}
          </div>
        </div>
      </div>

      {usesStone && (
        <div className="flex flex-col items-center gap-2">
          <div className="self-start text-[11px] text-gk-muted">Stone type</div>
          <StoneVariantWheel
            value={stoneVariant}
            onChange={setStoneVariant}
          />
          <div className="flex flex-wrap justify-center gap-1">
            {STONE_VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`rounded-md px-2 py-0.5 text-[11px] ${
                  stoneVariant === v.id
                    ? "bg-gk-accent-soft text-gk-accent"
                    : "text-gk-muted hover:bg-gk-hover hover:text-gk-ink"
                }`}
                onClick={() => setStoneVariant(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
