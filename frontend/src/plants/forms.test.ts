import { describe, expect, it } from "vitest";
import type { PlantSpecies, VisualParams } from "../document/schema";
import { resolveSeasonalForm } from "./forms";

const form = (color: string): VisualParams => ({
  foliage: { shape: "round", color, volume: 1 },
  bloom: { shape: "dot", color: "#fff", density: 0 },
  branching: { pattern: "upright", density: 0.5, color: "#000" },
});

const species = (forms: PlantSpecies["forms"]): PlantSpecies => ({
  id: "gk:test",
  commonName: "Test Plant",
  archetype: "shrub",
  tags: [],
  displayPhase: "mid-summer",
  forms,
});

describe("resolveSeasonalForm", () => {
  it("returns the exact form when the phase is defined", () => {
    const s = species({
      "mid-summer": form("#summer"),
      winter: form("#winter"),
    });
    expect(resolveSeasonalForm(s, "mid-summer").foliage.color).toBe("#summer");
    expect(resolveSeasonalForm(s, "winter").foliage.color).toBe("#winter");
  });

  it("falls back to the nearest defined phase", () => {
    const s = species({
      "mid-summer": form("#summer"),
      winter: form("#winter"),
    });
    // late-summer is 1 step from mid-summer, 4 from winter
    expect(resolveSeasonalForm(s, "late-summer").foliage.color).toBe("#summer");
    // late-fall is 1 step from winter
    expect(resolveSeasonalForm(s, "late-fall").foliage.color).toBe("#winter");
  });

  it("wraps cyclically through the year boundary", () => {
    const s = species({
      "late-fall": form("#fall"),
      "mid-summer": form("#summer"),
    });
    // early-spring is 2 steps from late-fall going backward through winter,
    // 4 steps from mid-summer
    expect(resolveSeasonalForm(s, "early-spring").foliage.color).toBe("#fall");
  });

  it("uses displayPhase when phase is null", () => {
    const s = species({ "mid-summer": form("#display") });
    expect(resolveSeasonalForm(s, null).foliage.color).toBe("#display");
  });

  it("renders every phase from a single defined form", () => {
    const s = species({ "mid-summer": form("#only") });
    for (const phase of [
      "early-spring",
      "winter",
      "late-fall",
      "mid-summer",
    ] as const) {
      expect(resolveSeasonalForm(s, phase).foliage.color).toBe("#only");
    }
  });

  it("throws for a species with no forms", () => {
    const s = species({});
    expect(() => resolveSeasonalForm(s, "winter")).toThrow(/no seasonal forms/);
  });
});
