import { describe, expect, it } from "vitest";
import {
  PlantSpecies,
  SEASON_PHASES,
  VisualParams,
  type SeasonPhase,
} from "../document/schema";
import { BUILTIN_SPECIES, BUILTIN_SPECIES_BY_ID } from "./catalog";
import { resolveSeasonalForm } from "./forms";

describe("builtin catalog", () => {
  it("has ~30 species", () => {
    expect(BUILTIN_SPECIES.length).toBeGreaterThanOrEqual(30);
  });

  it("covers every archetype", () => {
    const archetypes = new Set(BUILTIN_SPECIES.map((s) => s.archetype));
    expect(archetypes).toEqual(
      new Set([
        "tree",
        "shrub",
        "grass",
        "flower",
        "succulent",
        "groundcover",
        "vine",
      ]),
    );
  });

  it("uses unique 'gk:' prefixed ids", () => {
    const ids = BUILTIN_SPECIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^gk:[a-z0-9-]+$/);
    }
  });

  it("indexes every species by id", () => {
    for (const s of BUILTIN_SPECIES) {
      expect(BUILTIN_SPECIES_BY_ID.get(s.id)).toBe(s);
    }
  });

  for (const species of BUILTIN_SPECIES) {
    describe(species.commonName, () => {
      it("parses against the PlantSpecies schema", () => {
        expect(() => PlantSpecies.parse(species)).not.toThrow();
      });

      it("has valid VisualParams in every form", () => {
        const phases = Object.keys(species.forms) as SeasonPhase[];
        expect(phases.length).toBeGreaterThanOrEqual(3);
        for (const phase of phases) {
          expect(SEASON_PHASES).toContain(phase);
          expect(() => VisualParams.parse(species.forms[phase])).not.toThrow();
        }
      });

      it("defines an exact form at its displayPhase", () => {
        expect(species.forms[species.displayPhase]).toBeDefined();
      });

      it("resolves a form for every season phase", () => {
        for (const phase of SEASON_PHASES) {
          expect(() => resolveSeasonalForm(species, phase)).not.toThrow();
        }
        expect(() => resolveSeasonalForm(species, null)).not.toThrow();
      });
    });
  }
});
