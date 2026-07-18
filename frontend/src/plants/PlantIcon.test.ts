import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Archetype,
  BloomShape,
  FoliageShape,
  BranchingPattern,
  SEASON_PHASES,
  type VisualParams,
} from "../document/schema";
import { BUILTIN_SPECIES } from "./catalog";
import { resolveSeasonalForm } from "./forms";
import { PlantIcon, type PlantIconProps } from "./PlantIcon";

function render(props: PlantIconProps): string {
  return renderToStaticMarkup(createElement(PlantIcon, props));
}

const fullParams = (
  foliage: FoliageShape,
  bloom: BloomShape,
  pattern: BranchingPattern,
): VisualParams => ({
  foliage: { shape: foliage, color: "#388e3c", volume: 1 },
  bloom: { shape: bloom, color: "#e57373", density: 1 },
  branching: { pattern, density: 1, color: "#5d4037" },
});

describe("PlantIcon determinism", () => {
  it("renders identical markup for identical inputs (all catalog forms)", () => {
    for (const species of BUILTIN_SPECIES) {
      for (const phase of SEASON_PHASES) {
        const params = resolveSeasonalForm(species, phase);
        const props: PlantIconProps = {
          archetype: species.archetype,
          params,
          seed: 42,
          size: 100,
        };
        expect(render(props)).toBe(render(props));
      }
    }
  });

  it("renders different markup for different seeds", () => {
    const params = fullParams("lobed", "cluster", "upright");
    const a = render({ archetype: "tree", params, seed: 1, size: 100 });
    const b = render({ archetype: "tree", params, seed: 2, size: 100 });
    expect(a).not.toBe(b);
  });

  it("scales geometry with size but keeps the same structure", () => {
    const params = fullParams("round", "dot", "vase");
    const small = render({ archetype: "shrub", params, seed: 5, size: 40 });
    const large = render({ archetype: "shrub", params, seed: 5, size: 200 });
    const countTags = (s: string) => (s.match(/<[a-z]/g) ?? []).length;
    expect(countTags(small)).toBe(countTags(large));
  });
});

describe("PlantIcon output conventions", () => {
  it("renders a single <g> root with only export-safe primitives", () => {
    for (const archetype of Archetype.options) {
      const params = fullParams("lobed", "daisy", "clumping");
      const markup = render({ archetype, params, seed: 9, size: 100 });
      expect(markup.startsWith("<g>")).toBe(true);
      expect(markup.endsWith("</g>")).toBe(true);
      const tags = new Set(
        [...markup.matchAll(/<([a-z]+)[\s>]/g)].map((m) => m[1]),
      );
      for (const tag of tags) {
        expect(["g", "path", "circle", "ellipse"]).toContain(tag);
      }
    }
  });

  it("stays within the node budget at full density", { timeout: 20000 }, () => {
    const BUDGET = 80;
    const check = (props: PlantIconProps) => {
      const nodes = (render(props).match(/<[a-z]/g) ?? []).length;
      expect(nodes).toBeLessThan(BUDGET);
    };
    // every foliage x bloom combo with the stroke-heaviest pattern
    for (const foliage of FoliageShape.options) {
      for (const bloom of BloomShape.options) {
        check({
          archetype: "flower",
          params: fullParams(foliage, bloom, "clumping"),
          seed: 3,
          size: 100,
        });
      }
    }
    // every archetype x pattern combo
    for (const archetype of Archetype.options) {
      for (const pattern of BranchingPattern.options) {
        check({
          archetype,
          params: fullParams("lobed", "daisy", pattern),
          seed: 3,
          size: 100,
        });
      }
    }
  });

  it("renders bare branches (no canopy fill) at volume 0", () => {
    const params: VisualParams = {
      foliage: { shape: "lobed", color: "#388e3c", volume: 0 },
      bloom: { shape: "cluster", color: "#e57373", density: 0 },
      branching: { pattern: "upright", density: 0.7, color: "#5d4037" },
    };
    const markup = render({ archetype: "tree", params, seed: 11, size: 100 });
    expect(markup).not.toContain('fill="#388e3c"');
    expect(markup).toContain('stroke="#5d4037"');
  });

  it("renders no blooms at density 0", () => {
    const params: VisualParams = {
      foliage: { shape: "round", color: "#388e3c", volume: 1 },
      bloom: { shape: "daisy", color: "#ba2020", density: 0 },
      branching: { pattern: "vase", density: 0.5, color: "#5d4037" },
    };
    const markup = render({ archetype: "shrub", params, seed: 11, size: 100 });
    expect(markup).not.toContain("#ba2020");
  });
});
