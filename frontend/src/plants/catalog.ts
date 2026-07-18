/**
 * Built-in species catalog. Wave 1 ships three exemplar species that exercise
 * the model (tree / shrub / grass); Agent B expands this to ~30 common North
 * American garden plants. Catalog entries are pure data — a future agent can
 * generate hundreds of these.
 *
 * Convention: catalog species ids are prefixed "gk:" to distinguish built-ins
 * from user-defined species embedded in documents.
 */
import type { PlantSpecies } from "../document/schema";

export const BUILTIN_SPECIES: PlantSpecies[] = [
  {
    id: "gk:red-maple",
    commonName: "Red Maple",
    botanicalName: "Acer rubrum",
    archetype: "tree",
    tags: ["native", "shade", "red-fall-color"],
    displayPhase: "mid-fall",
    forms: {
      "mid-spring": {
        foliage: { shape: "lobed", color: "#7cb342", volume: 0.7 },
        bloom: { shape: "cluster", color: "#e57373", density: 0.4 },
        branching: { pattern: "upright", density: 0.7, color: "#5d4037" },
      },
      "mid-summer": {
        foliage: { shape: "lobed", color: "#388e3c", volume: 1 },
        bloom: { shape: "cluster", color: "#e57373", density: 0 },
        branching: { pattern: "upright", density: 0.7, color: "#5d4037" },
      },
      "mid-fall": {
        foliage: { shape: "lobed", color: "#d32f2f", volume: 0.9 },
        bloom: { shape: "cluster", color: "#e57373", density: 0 },
        branching: { pattern: "upright", density: 0.7, color: "#5d4037" },
      },
      winter: {
        foliage: { shape: "lobed", color: "#388e3c", volume: 0 },
        bloom: { shape: "cluster", color: "#e57373", density: 0 },
        branching: { pattern: "upright", density: 0.7, color: "#5d4037" },
      },
    },
  },
  {
    id: "gk:bigleaf-hydrangea",
    commonName: "Bigleaf Hydrangea",
    botanicalName: "Hydrangea macrophylla",
    archetype: "shrub",
    tags: ["blue", "shade-tolerant"],
    displayPhase: "mid-summer",
    forms: {
      "late-spring": {
        foliage: { shape: "oval", color: "#558b2f", volume: 0.9 },
        bloom: { shape: "cluster", color: "#64b5f6", density: 0.3 },
        branching: { pattern: "clumping", density: 0.8, color: "#6d4c41" },
      },
      "mid-summer": {
        foliage: { shape: "oval", color: "#33691e", volume: 1 },
        bloom: { shape: "cluster", color: "#42a5f5", density: 1 },
        branching: { pattern: "clumping", density: 0.8, color: "#6d4c41" },
      },
      winter: {
        foliage: { shape: "oval", color: "#33691e", volume: 0 },
        bloom: { shape: "cluster", color: "#42a5f5", density: 0 },
        branching: { pattern: "clumping", density: 0.8, color: "#6d4c41" },
      },
    },
  },
  {
    id: "gk:purple-fountain-grass",
    commonName: "Purple Fountain Grass",
    botanicalName: "Pennisetum setaceum 'Rubrum'",
    archetype: "grass",
    tags: ["purple", "ornamental", "full-sun"],
    displayPhase: "late-summer",
    forms: {
      "mid-summer": {
        foliage: { shape: "blade", color: "#6a1b9a", volume: 0.9 },
        bloom: { shape: "plume", color: "#ce93d8", density: 0.4 },
        branching: { pattern: "clumping", density: 0.9, color: "#4a148c" },
      },
      "late-summer": {
        foliage: { shape: "blade", color: "#6a1b9a", volume: 1 },
        bloom: { shape: "plume", color: "#ce93d8", density: 1 },
        branching: { pattern: "clumping", density: 0.9, color: "#4a148c" },
      },
      winter: {
        foliage: { shape: "blade", color: "#8d6e63", volume: 0.4 },
        bloom: { shape: "plume", color: "#bcaaa4", density: 0.2 },
        branching: { pattern: "clumping", density: 0.9, color: "#5d4037" },
      },
    },
  },
];

export const BUILTIN_SPECIES_BY_ID: ReadonlyMap<string, PlantSpecies> =
  new Map(BUILTIN_SPECIES.map((s) => [s.id, s]));
