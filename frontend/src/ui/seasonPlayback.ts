import { SEASON_PHASES, type SeasonPhase } from "../document/schema";

export const TIMELAPSE_MS = 800;

export const SEASON_NAMES = ["spring", "summer", "fall", "winter"] as const;
export type SeasonName = (typeof SEASON_NAMES)[number];

export const SEASON_POSITIONS = ["early", "mid", "late"] as const;
export type SeasonPosition = (typeof SEASON_POSITIONS)[number];

export const SEASON_LABELS: Record<SeasonName, string> = {
  spring: "Spring",
  summer: "Summer",
  fall: "Fall",
  winter: "Winter",
};

/** Subtle tint classes for the active season control. */
export const SEASON_ACTIVE_CLASS: Record<SeasonName, string> = {
  spring: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/45 dark:text-emerald-100",
  summer: "bg-amber-100 text-amber-950 dark:bg-amber-900/45 dark:text-amber-100",
  fall: "bg-orange-100 text-orange-950 dark:bg-orange-900/45 dark:text-orange-100",
  winter: "bg-sky-100 text-sky-950 dark:bg-sky-900/45 dark:text-sky-100",
};

/** Next phase in the cycle (after the last comes the first). */
export function nextSeasonPhase(current: SeasonPhase | null): SeasonPhase {
  if (current === null) return SEASON_PHASES[0];
  const i = SEASON_PHASES.indexOf(current);
  return SEASON_PHASES[(i + 1) % SEASON_PHASES.length];
}

export function seasonOfPhase(phase: SeasonPhase): SeasonName {
  if (phase === "winter") return "winter";
  if (phase.endsWith("spring")) return "spring";
  if (phase.endsWith("summer")) return "summer";
  return "fall";
}

/** Sub-phase within a season; winter has none. */
export function positionOfPhase(phase: SeasonPhase): SeasonPosition | null {
  if (phase === "winter") return null;
  if (phase.startsWith("early")) return "early";
  if (phase.startsWith("mid")) return "mid";
  return "late";
}

export function seasonHasPositions(season: SeasonName): boolean {
  return season !== "winter";
}

export function phaseFromSeason(
  season: SeasonName,
  position: SeasonPosition = "mid",
): SeasonPhase {
  if (season === "winter") return "winter";
  return `${position}-${season}` as SeasonPhase;
}

export function positionIndex(position: SeasonPosition): number {
  return SEASON_POSITIONS.indexOf(position);
}

export function positionFromIndex(index: number): SeasonPosition {
  const clamped = Math.max(0, Math.min(SEASON_POSITIONS.length - 1, Math.round(index)));
  return SEASON_POSITIONS[clamped];
}

export const SEASON_GROUPS: {
  label: string;
  season: SeasonName;
  phases: SeasonPhase[];
}[] = SEASON_NAMES.map((season) => ({
  label: SEASON_LABELS[season],
  season,
  phases:
    season === "winter"
      ? (["winter"] as SeasonPhase[])
      : SEASON_POSITIONS.map((pos) => phaseFromSeason(season, pos)),
}));

export function phaseShortLabel(phase: SeasonPhase): string {
  if (phase === "winter") return "W";
  if (phase.startsWith("early")) return "E";
  if (phase.startsWith("mid")) return "M";
  return "L";
}
