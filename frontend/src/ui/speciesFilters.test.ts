import { describe, expect, it } from "vitest";
import type { PlantSpecies } from "../document/schema";
import {
  filterSpecies,
  groupPlacedPlants,
  mergeCatalog,
} from "./speciesFilters";

const maple: PlantSpecies = {
  id: "gk:red-maple",
  commonName: "Red Maple",
  archetype: "tree",
  tags: ["native", "shade"],
  displayPhase: "mid-fall",
  forms: {
    "mid-fall": {
      foliage: { shape: "lobed", color: "#d32f2f", volume: 1 },
      bloom: { shape: "cluster", color: "#e57373", density: 0 },
      branching: { pattern: "upright", density: 0.7, color: "#5d4037" },
    },
  },
};

const hosta: PlantSpecies = {
  id: "gk:hosta",
  commonName: "Hosta",
  archetype: "flower",
  tags: ["shade"],
  displayPhase: "mid-summer",
  forms: {
    "mid-summer": {
      foliage: { shape: "heart", color: "#558b2f", volume: 1 },
      bloom: { shape: "bell", color: "#b39ddb", density: 0.5 },
      branching: { pattern: "clumping", density: 0.6, color: "#6d4c41" },
    },
  },
};

describe("mergeCatalog", () => {
  it("includes builtins and lets document override", () => {
    const override = { ...maple, commonName: "My Maple" };
    const list = mergeCatalog({ [override.id]: override });
    expect(list.find((s) => s.id === maple.id)?.commonName).toBe("My Maple");
    expect(list.length).toBeGreaterThan(1);
  });
});

describe("filterSpecies", () => {
  const all = [maple, hosta];

  it("filters by query", () => {
    expect(filterSpecies(all, { query: "maple", archetypes: new Set(), tag: null })).toEqual([
      maple,
    ]);
  });

  it("filters by archetype", () => {
    expect(
      filterSpecies(all, {
        query: "",
        archetypes: new Set(["flower"]),
        tag: null,
      }),
    ).toEqual([hosta]);
  });

  it("filters by tag", () => {
    expect(
      filterSpecies(all, { query: "", archetypes: new Set(), tag: "native" }),
    ).toEqual([maple]);
  });
});

describe("groupPlacedPlants", () => {
  it("groups element ids by species", () => {
    const groups = groupPlacedPlants(
      [
        { id: "a", speciesId: maple.id },
        { id: "b", speciesId: maple.id },
        { id: "c", speciesId: hosta.id },
      ],
      [maple, hosta],
    );
    expect(groups).toHaveLength(2);
    const mapleGroup = groups.find((g) => g.species.id === maple.id)!;
    expect(mapleGroup.elementIds).toEqual(["a", "b"]);
  });
});
