/**
 * Season phase toggle + timelapse. Bottom-center floating bar.
 * Four seasons + early/mid/late slider (winter has no subphases).
 */
import { useEffect, useRef, useState } from "react";
import { SEASON_PHASES, type SeasonPhase } from "../document/schema";
import { useEditorStore, selectActiveView } from "../document/store";
import {
  nextSeasonPhase,
  phaseFromSeason,
  positionFromIndex,
  positionIndex,
  positionOfPhase,
  SEASON_ACTIVE_CLASS,
  SEASON_LABELS,
  SEASON_NAMES,
  SEASON_POSITIONS,
  seasonHasPositions,
  seasonOfPhase,
  TIMELAPSE_MS,
  type SeasonName,
  type SeasonPosition,
} from "./seasonPlayback";

export function SeasonBar() {
  const seasonPhase = useEditorStore((s) => s.seasonPhase);
  const setSeasonPhase = useEditorStore((s) => s.setSeasonPhase);
  const view = useEditorStore(selectActiveView);
  const hasPlants = view.elements.some((el) => el.type === "plant");

  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSeason = seasonPhase ? seasonOfPhase(seasonPhase) : null;
  const activePosition = seasonPhase ? positionOfPhase(seasonPhase) : null;
  const showSlider =
    activeSeason !== null && seasonHasPositions(activeSeason);

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(() => {
      const current = useEditorStore.getState().seasonPhase;
      useEditorStore.getState().setSeasonPhase(nextSeasonPhase(current));
    }, TIMELAPSE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && playing) setPlaying(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  function selectPhase(phase: SeasonPhase | null) {
    setPlaying(false);
    setSeasonPhase(phase);
  }

  function selectSeason(season: SeasonName) {
    setPlaying(false);
    if (season === "winter") {
      setSeasonPhase("winter");
      return;
    }
    const pos: SeasonPosition = activePosition ?? "mid";
    setSeasonPhase(phaseFromSeason(season, pos));
  }

  function selectPosition(pos: SeasonPosition) {
    if (!activeSeason || !seasonHasPositions(activeSeason)) return;
    setPlaying(false);
    setSeasonPhase(phaseFromSeason(activeSeason, pos));
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-gk-line bg-gk-panel px-2 py-1.5 shadow-md ${
        hasPlants ? "" : "opacity-60"
      }`}
    >
      <button
        type="button"
        title={playing ? "Pause timelapse" : "Play season timelapse"}
        className="rounded px-2 py-1 text-sm hover:bg-gk-hover"
        onClick={() => {
          if (!playing && seasonPhase === null) {
            setSeasonPhase(SEASON_PHASES[0]);
          }
          setPlaying((p) => !p);
        }}
      >
        {playing ? "Pause" : "Play"}
      </button>

      <button
        type="button"
        className={`rounded px-2 py-1 text-xs ${
          seasonPhase === null
            ? "bg-gk-accent text-gk-panel"
            : "text-gk-muted hover:bg-gk-hover"
        }`}
        onClick={() => selectPhase(null)}
        title="Each plant at its showiest form"
      >
        Display
      </button>

      <span className="text-gk-line">|</span>

      <div className="flex items-center gap-0.5">
        {SEASON_NAMES.map((season) => {
          const active = activeSeason === season;
          return (
            <button
              key={season}
              type="button"
              title={SEASON_LABELS[season]}
              className={`rounded px-2 py-1 text-xs ${
                active
                  ? SEASON_ACTIVE_CLASS[season]
                  : "text-gk-muted hover:bg-gk-hover"
              }`}
              onClick={() => selectSeason(season)}
            >
              {SEASON_LABELS[season]}
            </button>
          );
        })}
      </div>

      {showSlider && activePosition && (
        <>
          <span className="text-gk-line">|</span>
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-[10px] uppercase tracking-wide text-gk-muted">
              Early
            </span>
            <input
              type="range"
              min={0}
              max={SEASON_POSITIONS.length - 1}
              step={1}
              value={positionIndex(activePosition)}
              aria-label="Season position"
              title={`${activePosition} ${activeSeason}`}
              className="h-1.5 w-20 cursor-pointer accent-gk-accent"
              onChange={(e) =>
                selectPosition(positionFromIndex(Number(e.target.value)))
              }
            />
            <span className="text-[10px] uppercase tracking-wide text-gk-muted">
              Late
            </span>
          </div>
        </>
      )}
    </div>
  );
}
