import { describe, expect, it } from "vitest";
import { SEASON_PHASES } from "../document/schema";
import {
  nextSeasonPhase,
  phaseFromSeason,
  positionFromIndex,
  positionIndex,
  positionOfPhase,
  SEASON_GROUPS,
  SEASON_NAMES,
  SEASON_POSITIONS,
  seasonHasPositions,
  seasonOfPhase,
} from "./seasonPlayback";

describe("nextSeasonPhase", () => {
  it("starts at early-spring from display mode", () => {
    expect(nextSeasonPhase(null)).toBe("early-spring");
  });

  it("advances through the year and wraps", () => {
    expect(nextSeasonPhase("early-spring")).toBe("mid-spring");
    expect(nextSeasonPhase("winter")).toBe("early-spring");
    let phase = nextSeasonPhase(null);
    for (let i = 0; i < SEASON_PHASES.length - 1; i++) {
      phase = nextSeasonPhase(phase);
    }
    expect(phase).toBe("winter");
  });

  it("walks all 10 SeasonPhase keys", () => {
    const seen: string[] = [];
    let phase = nextSeasonPhase(null);
    for (let i = 0; i < SEASON_PHASES.length; i++) {
      seen.push(phase);
      phase = nextSeasonPhase(phase);
    }
    expect(seen).toEqual([...SEASON_PHASES]);
  });
});

describe("seasonOfPhase / positionOfPhase", () => {
  it("maps phased seasons and winter", () => {
    expect(seasonOfPhase("early-spring")).toBe("spring");
    expect(seasonOfPhase("mid-summer")).toBe("summer");
    expect(seasonOfPhase("late-fall")).toBe("fall");
    expect(seasonOfPhase("winter")).toBe("winter");
  });

  it("returns early/mid/late or null for winter", () => {
    expect(positionOfPhase("early-spring")).toBe("early");
    expect(positionOfPhase("mid-summer")).toBe("mid");
    expect(positionOfPhase("late-fall")).toBe("late");
    expect(positionOfPhase("winter")).toBeNull();
  });
});

describe("phaseFromSeason", () => {
  it("builds early/mid/late phases and winter alone", () => {
    expect(phaseFromSeason("spring", "early")).toBe("early-spring");
    expect(phaseFromSeason("summer", "mid")).toBe("mid-summer");
    expect(phaseFromSeason("fall", "late")).toBe("late-fall");
    expect(phaseFromSeason("winter")).toBe("winter");
    expect(phaseFromSeason("winter", "early")).toBe("winter");
  });

  it("defaults to mid when position omitted", () => {
    expect(phaseFromSeason("spring")).toBe("mid-spring");
  });
});

describe("seasonHasPositions", () => {
  it("is false only for winter", () => {
    expect(seasonHasPositions("spring")).toBe(true);
    expect(seasonHasPositions("summer")).toBe(true);
    expect(seasonHasPositions("fall")).toBe(true);
    expect(seasonHasPositions("winter")).toBe(false);
  });
});

describe("positionIndex / positionFromIndex", () => {
  it("round-trips early/mid/late", () => {
    for (const pos of SEASON_POSITIONS) {
      expect(positionFromIndex(positionIndex(pos))).toBe(pos);
    }
  });

  it("clamps out-of-range indices", () => {
    expect(positionFromIndex(-1)).toBe("early");
    expect(positionFromIndex(99)).toBe("late");
  });
});

describe("SEASON_GROUPS", () => {
  it("covers all seasons and all 10 phases", () => {
    expect(SEASON_GROUPS.map((g) => g.season)).toEqual([...SEASON_NAMES]);
    const phases = SEASON_GROUPS.flatMap((g) => g.phases);
    expect(phases).toEqual([...SEASON_PHASES]);
  });
});
