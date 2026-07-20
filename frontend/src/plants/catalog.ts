/**
 * Built-in species catalog: ~30 common North American garden plants across
 * all archetypes. Catalog entries are pure data — a future agent can generate
 * hundreds of these.
 *
 * Convention: catalog species ids are prefixed "gk:" to distinguish built-ins
 * from user-defined species embedded in documents.
 */
import type {
  BloomShape,
  BranchingPattern,
  FoliageShape,
  PlantSpecies,
  SeasonPhase,
  VisualParams,
} from "../document/schema";

// ---------------------------------------------------------------------------
// Compact seasonal-form builder. Species-constant traits (foliage shape,
// bloom shape, branching) are given once; each season lists foliage color,
// volume and bloom density. Everything expands to plain VisualParams data.
// ---------------------------------------------------------------------------

interface SpeciesBase {
  foliage: FoliageShape;
  bloom: BloomShape;
  /** Default bloom color (used even at density 0 — schema requires it). */
  bloomColor: string;
  branch: { pattern: BranchingPattern; density: number; color: string };
}

interface SeasonSpec {
  /** Foliage color for this phase. */
  leaf: string;
  /** Foliage volume 0-1 (0 = bare winter deciduous). */
  vol: number;
  /** Bloom density 0-1 (default 0). */
  bloom?: number;
  /** Bloom color override for this phase (e.g. buds vs. peak). */
  flower?: string;
  /** Branch color override for this phase (e.g. bleached winter stems). */
  stems?: string;
}

function forms(
  base: SpeciesBase,
  seasons: Partial<Record<SeasonPhase, SeasonSpec>>,
): PlantSpecies["forms"] {
  const out: PlantSpecies["forms"] = {};
  for (const [phase, s] of Object.entries(seasons) as [
    SeasonPhase,
    SeasonSpec,
  ][]) {
    const form: VisualParams = {
      foliage: { shape: base.foliage, color: s.leaf, volume: s.vol },
      bloom: {
        shape: base.bloom,
        color: s.flower ?? base.bloomColor,
        density: s.bloom ?? 0,
      },
      branching: s.stems ? { ...base.branch, color: s.stems } : base.branch,
    };
    out[phase] = form;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

const TREES: PlantSpecies[] = [
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
    id: "gk:sugar-maple",
    commonName: "Sugar Maple",
    botanicalName: "Acer saccharum",
    archetype: "tree",
    tags: ["native", "shade", "orange-fall-color", "large"],
    displayPhase: "mid-fall",
    forms: forms(
      {
        foliage: "lobed",
        bloom: "cluster",
        bloomColor: "#cddc39",
        branch: { pattern: "upright", density: 0.75, color: "#4e342e" },
      },
      {
        "mid-spring": { leaf: "#8bc34a", vol: 0.7, bloom: 0.2 },
        "mid-summer": { leaf: "#2e7d32", vol: 1 },
        "mid-fall": { leaf: "#f57c00", vol: 0.9 },
        winter: { leaf: "#2e7d32", vol: 0 },
      },
    ),
  },
  {
    id: "gk:northern-red-oak",
    commonName: "Northern Red Oak",
    botanicalName: "Quercus rubra",
    archetype: "tree",
    tags: ["native", "shade", "red-fall-color", "large", "wildlife"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "lobed",
        bloom: "cluster",
        bloomColor: "#c0ca33",
        branch: { pattern: "spreading", density: 0.7, color: "#3e2723" },
      },
      {
        "mid-spring": { leaf: "#9ccc65", vol: 0.6, bloom: 0.2 },
        "mid-summer": { leaf: "#33691e", vol: 1 },
        "mid-fall": { leaf: "#bf360c", vol: 0.85 },
        "late-fall": { leaf: "#8d6e63", vol: 0.4 },
        winter: { leaf: "#33691e", vol: 0 },
      },
    ),
  },
  {
    id: "gk:flowering-dogwood",
    commonName: "Flowering Dogwood",
    botanicalName: "Cornus florida",
    archetype: "tree",
    tags: ["native", "white", "understory", "part-shade", "spring-bloom"],
    displayPhase: "mid-spring",
    forms: forms(
      {
        foliage: "oval",
        bloom: "daisy",
        bloomColor: "#fdfdf5",
        branch: { pattern: "spreading", density: 0.6, color: "#4e342e" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.55, bloom: 1 },
        "late-spring": { leaf: "#558b2f", vol: 0.85, bloom: 0.3 },
        "mid-summer": { leaf: "#33691e", vol: 1 },
        "mid-fall": { leaf: "#c62828", vol: 0.85, bloom: 0.2, flower: "#e53935" },
        winter: { leaf: "#33691e", vol: 0 },
      },
    ),
  },
  {
    id: "gk:eastern-redbud",
    commonName: "Eastern Redbud",
    botanicalName: "Cercis canadensis",
    archetype: "tree",
    tags: ["native", "pink", "understory", "spring-bloom"],
    displayPhase: "early-spring",
    forms: forms(
      {
        foliage: "heart",
        bloom: "cluster",
        bloomColor: "#e91e63",
        branch: { pattern: "vase", density: 0.7, color: "#4e342e" },
      },
      {
        "early-spring": { leaf: "#7cb342", vol: 0.08, bloom: 1 },
        "mid-spring": { leaf: "#7cb342", vol: 0.6, bloom: 0.5 },
        "mid-summer": { leaf: "#2e7d32", vol: 1 },
        "mid-fall": { leaf: "#fbc02d", vol: 0.8 },
        winter: { leaf: "#2e7d32", vol: 0 },
      },
    ),
  },
  {
    id: "gk:japanese-maple",
    commonName: "Japanese Maple",
    botanicalName: "Acer palmatum",
    archetype: "tree",
    tags: ["red", "ornamental", "part-shade", "specimen"],
    displayPhase: "mid-fall",
    forms: forms(
      {
        // Lobed palmate leaves — not "spiky"/conifer (that drew a triangle hat).
        foliage: "lobed",
        bloom: "dot",
        bloomColor: "#ad1457",
        branch: { pattern: "umbrella", density: 0.8, color: "#3e2723" },
      },
      {
        "mid-spring": { leaf: "#c62828", vol: 0.7 },
        "mid-summer": { leaf: "#8e2424", vol: 1 },
        "mid-fall": { leaf: "#e53935", vol: 0.95 },
        winter: { leaf: "#8e2424", vol: 0 },
      },
    ),
  },
  {
    id: "gk:river-birch",
    commonName: "River Birch",
    botanicalName: "Betula nigra",
    archetype: "tree",
    tags: ["native", "fast-growing", "wet-tolerant", "yellow-fall-color"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "oval",
        bloom: "spike",
        bloomColor: "#c5a05a",
        branch: { pattern: "upright", density: 0.8, color: "#8d6e63" },
      },
      {
        "mid-spring": { leaf: "#9ccc65", vol: 0.65, bloom: 0.3 },
        "mid-summer": { leaf: "#558b2f", vol: 1 },
        "mid-fall": { leaf: "#f9a825", vol: 0.8 },
        winter: { leaf: "#558b2f", vol: 0, stems: "#a1887f" },
      },
    ),
  },
  {
    id: "gk:colorado-blue-spruce",
    commonName: "Colorado Blue Spruce",
    botanicalName: "Picea pungens",
    archetype: "tree",
    tags: ["evergreen", "blue", "full-sun", "screen", "winter-interest"],
    displayPhase: "winter",
    forms: forms(
      {
        foliage: "needle",
        bloom: "dot",
        bloomColor: "#8d6e63",
        branch: { pattern: "upright", density: 0.85, color: "#4e342e" },
      },
      {
        "mid-spring": { leaf: "#78a0a8", vol: 1 },
        "mid-summer": { leaf: "#6a929a", vol: 1 },
        "mid-fall": { leaf: "#6a929a", vol: 1 },
        winter: { leaf: "#5d8189", vol: 1 },
      },
    ),
  },
];

// ---------------------------------------------------------------------------
// Shrubs
// ---------------------------------------------------------------------------

const SHRUBS: PlantSpecies[] = [
  {
    id: "gk:bigleaf-hydrangea",
    commonName: "Bigleaf Hydrangea",
    botanicalName: "Hydrangea macrophylla",
    archetype: "shrub",
    tags: ["blue", "shade-tolerant"],
    displayPhase: "mid-summer",
    forms: {
      "mid-spring": {
        foliage: { shape: "oval", color: "#7cb342", volume: 0.7 },
        bloom: { shape: "cluster", color: "#64b5f6", density: 0 },
        branching: { pattern: "clumping", density: 0.8, color: "#6d4c41" },
      },
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
      "mid-fall": {
        foliage: { shape: "oval", color: "#827717", volume: 0.75 },
        bloom: { shape: "cluster", color: "#90caf9", density: 0 },
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
    id: "gk:boxwood",
    commonName: "Boxwood",
    botanicalName: "Buxus sempervirens",
    archetype: "shrub",
    tags: ["evergreen", "hedge", "formal", "deer-resistant"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "round",
        bloom: "dot",
        bloomColor: "#dce775",
        branch: { pattern: "upright", density: 0.5, color: "#5d4037" },
      },
      {
        "mid-spring": { leaf: "#66953f", vol: 1 },
        "mid-summer": { leaf: "#4c7a3d", vol: 1 },
        "mid-fall": { leaf: "#4c7a3d", vol: 1 },
        winter: { leaf: "#5d6e3f", vol: 1 },
      },
    ),
  },
  {
    id: "gk:azalea",
    commonName: "Azalea",
    botanicalName: "Rhododendron spp.",
    archetype: "shrub",
    tags: ["pink", "shade-tolerant", "acid-loving", "spring-bloom"],
    displayPhase: "mid-spring",
    forms: forms(
      {
        foliage: "oval",
        bloom: "trumpet",
        bloomColor: "#ec407a",
        branch: { pattern: "spreading", density: 0.7, color: "#5d4037" },
      },
      {
        "mid-spring": { leaf: "#4c7a3d", vol: 0.9, bloom: 1 },
        "late-spring": { leaf: "#4c7a3d", vol: 0.95, bloom: 0.4 },
        "mid-summer": { leaf: "#3d6633", vol: 1 },
        "mid-fall": { leaf: "#3d6633", vol: 0.95 },
        winter: { leaf: "#4a5d3a", vol: 0.85 },
      },
    ),
  },
  {
    id: "gk:common-lilac",
    commonName: "Common Lilac",
    botanicalName: "Syringa vulgaris",
    archetype: "shrub",
    tags: ["purple", "fragrant", "full-sun", "spring-bloom"],
    displayPhase: "late-spring",
    forms: forms(
      {
        foliage: "heart",
        bloom: "cluster",
        bloomColor: "#9575cd",
        branch: { pattern: "vase", density: 0.75, color: "#5d4037" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.8, bloom: 0.3 },
        "late-spring": { leaf: "#558b2f", vol: 0.95, bloom: 1 },
        "mid-summer": { leaf: "#33691e", vol: 1 },
        "mid-fall": { leaf: "#827717", vol: 0.7 },
        winter: { leaf: "#33691e", vol: 0 },
      },
    ),
  },
  {
    id: "gk:creeping-juniper",
    commonName: "Creeping Juniper",
    botanicalName: "Juniperus horizontalis",
    archetype: "shrub",
    tags: ["evergreen", "native", "drought-tolerant", "full-sun", "slopes"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "needle",
        bloom: "dot",
        bloomColor: "#6d83a8",
        branch: { pattern: "spreading", density: 0.85, color: "#5d4037" },
      },
      {
        "mid-spring": { leaf: "#58756a", vol: 1 },
        "mid-summer": { leaf: "#58756a", vol: 1 },
        "early-fall": { leaf: "#58756a", vol: 1, bloom: 0.3 },
        "mid-fall": { leaf: "#4f6a60", vol: 1 },
        winter: { leaf: "#4f6a60", vol: 1 },
      },
    ),
  },
  {
    id: "gk:burning-bush",
    commonName: "Burning Bush",
    botanicalName: "Euonymus alatus",
    archetype: "shrub",
    tags: ["red-fall-color", "hedge", "full-sun"],
    displayPhase: "mid-fall",
    forms: forms(
      {
        foliage: "oval",
        bloom: "dot",
        bloomColor: "#c62828",
        branch: { pattern: "vase", density: 0.8, color: "#5d4037" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.8 },
        "mid-summer": { leaf: "#43a047", vol: 1 },
        "early-fall": { leaf: "#e53935", vol: 0.95 },
        "mid-fall": { leaf: "#d81b60", vol: 0.9, bloom: 0.2 },
        winter: { leaf: "#43a047", vol: 0 },
      },
    ),
  },
  {
    id: "gk:knock-out-rose",
    commonName: "Knock Out Rose",
    botanicalName: "Rosa 'Knock Out'",
    archetype: "shrub",
    tags: ["red", "long-blooming", "full-sun"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "oval",
        bloom: "daisy",
        bloomColor: "#e5395c",
        branch: { pattern: "clumping", density: 0.7, color: "#33691e" },
      },
      {
        "mid-spring": { leaf: "#558b2f", vol: 0.5 },
        "late-spring": { leaf: "#2e7d32", vol: 0.9, bloom: 0.5 },
        "mid-summer": { leaf: "#2e7d32", vol: 1, bloom: 1 },
        "early-fall": { leaf: "#33691e", vol: 0.95, bloom: 0.8 },
        "mid-fall": { leaf: "#33691e", vol: 0.85, bloom: 0.3 },
        winter: { leaf: "#2e7d32", vol: 0 },
      },
    ),
  },
];

// ---------------------------------------------------------------------------
// Grasses
// ---------------------------------------------------------------------------

const GRASSES: PlantSpecies[] = [
  {
    id: "gk:purple-fountain-grass",
    commonName: "Purple Fountain Grass",
    botanicalName: "Pennisetum setaceum 'Rubrum'",
    archetype: "grass",
    tags: ["purple", "ornamental", "full-sun"],
    displayPhase: "late-summer",
    forms: {
      "mid-spring": {
        foliage: { shape: "blade", color: "#7e57c2", volume: 0.4 },
        bloom: { shape: "plume", color: "#ce93d8", density: 0 },
        branching: { pattern: "clumping", density: 0.9, color: "#4a148c" },
      },
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
      "mid-fall": {
        foliage: { shape: "blade", color: "#7e57c2", volume: 0.7 },
        bloom: { shape: "plume", color: "#ce93d8", density: 0.5 },
        branching: { pattern: "clumping", density: 0.9, color: "#4a148c" },
      },
      // Tender; dies to the ground after frost in most of N. America.
      winter: {
        foliage: { shape: "blade", color: "#8d6e63", volume: 0 },
        bloom: { shape: "plume", color: "#bcaaa4", density: 0 },
        branching: { pattern: "clumping", density: 0.9, color: "#5d4037" },
      },
    },
  },
  {
    id: "gk:feather-reed-grass",
    commonName: "Feather Reed Grass",
    botanicalName: "Calamagrostis × acutiflora 'Karl Foerster'",
    archetype: "grass",
    tags: ["ornamental", "upright", "full-sun", "winter-interest"],
    displayPhase: "late-summer",
    forms: forms(
      {
        foliage: "blade",
        bloom: "plume",
        bloomColor: "#d7b46a",
        branch: { pattern: "clumping", density: 0.95, color: "#558b2f" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.7 },
        "late-spring": { leaf: "#7cb342", vol: 0.9 },
        "early-summer": { leaf: "#689f38", vol: 1, bloom: 0.7, flower: "#c9a0dc" },
        "mid-summer": { leaf: "#689f38", vol: 1, bloom: 0.9 },
        "late-summer": { leaf: "#689f38", vol: 1, bloom: 1 },
        "mid-fall": { leaf: "#c9a227", vol: 0.9, bloom: 0.8 },
        // Stands as tawny winter interest (not evergreen living green).
        winter: { leaf: "#c2a878", vol: 0.7, bloom: 0.5, flower: "#d6c6a5", stems: "#a1887f" },
      },
    ),
  },
  {
    id: "gk:blue-fescue",
    commonName: "Blue Fescue",
    botanicalName: "Festuca glauca",
    archetype: "grass",
    tags: ["blue", "evergreen", "drought-tolerant", "edging", "full-sun"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "blade",
        bloom: "plume",
        bloomColor: "#cbb583",
        branch: { pattern: "clumping", density: 0.9, color: "#6b87a3" },
      },
      {
        "mid-spring": { leaf: "#8fa8bf", vol: 0.9 },
        "early-summer": { leaf: "#8fa8bf", vol: 1, bloom: 0.4 },
        "mid-summer": { leaf: "#7d9ec7", vol: 1, bloom: 0.2 },
        "mid-fall": { leaf: "#7c8fa3", vol: 0.9 },
        winter: { leaf: "#7c8fa3", vol: 0.8 },
      },
    ),
  },
  {
    id: "gk:switchgrass",
    commonName: "Switchgrass",
    botanicalName: "Panicum virgatum",
    archetype: "grass",
    tags: ["native", "full-sun", "winter-interest", "wildlife"],
    displayPhase: "early-fall",
    forms: forms(
      {
        foliage: "blade",
        bloom: "plume",
        bloomColor: "#d4a5a5",
        branch: { pattern: "clumping", density: 0.9, color: "#558b2f" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.5 },
        "early-summer": { leaf: "#689f38", vol: 0.9 },
        "mid-summer": { leaf: "#689f38", vol: 1, bloom: 0.4 },
        "late-summer": { leaf: "#689f38", vol: 1, bloom: 0.8 },
        "early-fall": { leaf: "#d4a017", vol: 1, bloom: 1 },
        "mid-fall": { leaf: "#c9a227", vol: 0.95, bloom: 0.8 },
        "late-fall": { leaf: "#c2a878", vol: 0.8, bloom: 0.6, flower: "#d6c6a5" },
        winter: { leaf: "#b8a07e", vol: 0.6, bloom: 0.3, flower: "#d6c6a5", stems: "#8d6e63" },
      },
    ),
  },
];

// ---------------------------------------------------------------------------
// Flowers (perennials & bulbs)
// ---------------------------------------------------------------------------

const FLOWERS: PlantSpecies[] = [
  {
    id: "gk:purple-coneflower",
    commonName: "Purple Coneflower",
    botanicalName: "Echinacea purpurea",
    archetype: "flower",
    tags: ["native", "purple", "pollinator", "full-sun", "drought-tolerant"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "oval",
        bloom: "daisy",
        bloomColor: "#c94f7c",
        branch: { pattern: "clumping", density: 0.6, color: "#33691e" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.45 },
        "late-spring": { leaf: "#558b2f", vol: 0.8 },
        "mid-summer": { leaf: "#33691e", vol: 1, bloom: 1 },
        "early-fall": { leaf: "#33691e", vol: 0.9, bloom: 0.5 },
        "mid-fall": { leaf: "#6d5c4b", vol: 0.35, bloom: 0 },
        // Herbaceous; dies back (dried seed heads are stems, not foliage/bloom).
        winter: { leaf: "#6d5c4b", vol: 0 },
      },
    ),
  },
  {
    id: "gk:black-eyed-susan",
    commonName: "Black-Eyed Susan",
    botanicalName: "Rudbeckia fulgida",
    archetype: "flower",
    tags: ["native", "yellow", "pollinator", "full-sun", "easy"],
    displayPhase: "late-summer",
    forms: forms(
      {
        foliage: "oval",
        bloom: "daisy",
        bloomColor: "#f9a825",
        branch: { pattern: "clumping", density: 0.6, color: "#33691e" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.5 },
        "early-summer": { leaf: "#558b2f", vol: 0.9, bloom: 0.3 },
        "mid-summer": { leaf: "#33691e", vol: 1, bloom: 0.8 },
        "late-summer": { leaf: "#33691e", vol: 1, bloom: 1 },
        "early-fall": { leaf: "#546e2f", vol: 0.9, bloom: 0.6 },
        "mid-fall": { leaf: "#6d5c4b", vol: 0.3 },
        winter: { leaf: "#6d5c4b", vol: 0 },
      },
    ),
  },
  {
    id: "gk:daylily",
    commonName: "Daylily",
    botanicalName: "Hemerocallis 'Stella de Oro'",
    archetype: "flower",
    tags: ["orange", "yellow", "easy", "full-sun", "long-blooming"],
    displayPhase: "early-summer",
    forms: forms(
      {
        foliage: "blade",
        bloom: "trumpet",
        bloomColor: "#ef9a1d",
        branch: { pattern: "clumping", density: 0.8, color: "#558b2f" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.7 },
        "early-summer": { leaf: "#558b2f", vol: 1, bloom: 1 },
        "mid-summer": { leaf: "#558b2f", vol: 1, bloom: 0.7 },
        "mid-fall": { leaf: "#827717", vol: 0.5 },
        winter: { leaf: "#8d6e63", vol: 0 },
      },
    ),
  },
  {
    id: "gk:hosta",
    commonName: "Hosta",
    botanicalName: "Hosta 'Halcyon'",
    archetype: "flower",
    tags: ["shade", "foliage", "blue", "easy"],
    displayPhase: "early-summer",
    forms: forms(
      {
        foliage: "heart",
        bloom: "bell",
        bloomColor: "#b39ddb",
        branch: { pattern: "clumping", density: 0.5, color: "#4a7c3f" },
      },
      {
        "mid-spring": { leaf: "#6b9080", vol: 0.6 },
        "early-summer": { leaf: "#567d68", vol: 1, bloom: 0.3 },
        "mid-summer": { leaf: "#567d68", vol: 1, bloom: 0.6 },
        "mid-fall": { leaf: "#c0a43c", vol: 0.35 },
        // Fully deciduous; mush after frost.
        winter: { leaf: "#8d6e63", vol: 0 },
      },
    ),
  },
  {
    id: "gk:tulip",
    commonName: "Tulip",
    botanicalName: "Tulipa 'Red Impression'",
    archetype: "flower",
    tags: ["red", "spring-bloom", "bulb", "full-sun"],
    displayPhase: "mid-spring",
    forms: forms(
      {
        foliage: "blade",
        bloom: "star",
        bloomColor: "#e53935",
        branch: { pattern: "upright", density: 0.4, color: "#558b2f" },
      },
      {
        "early-spring": { leaf: "#7cb342", vol: 0.4, bloom: 0.2 },
        "mid-spring": { leaf: "#689f38", vol: 0.5, bloom: 1 },
        "late-spring": { leaf: "#9e9d24", vol: 0.3, bloom: 0.2 },
        // Dormant underground after foliage yellows; no summer/fall/winter top growth.
        "early-summer": { leaf: "#c0a43c", vol: 0 },
        "mid-summer": { leaf: "#c0a43c", vol: 0 },
        "mid-fall": { leaf: "#c0a43c", vol: 0 },
        winter: { leaf: "#c0a43c", vol: 0 },
      },
    ),
  },
  {
    id: "gk:daffodil",
    commonName: "Daffodil",
    botanicalName: "Narcissus 'Dutch Master'",
    archetype: "flower",
    tags: ["yellow", "spring-bloom", "bulb", "deer-resistant", "naturalizing"],
    displayPhase: "early-spring",
    forms: forms(
      {
        foliage: "blade",
        bloom: "trumpet",
        bloomColor: "#fdd835",
        branch: { pattern: "clumping", density: 0.6, color: "#558b2f" },
      },
      {
        "early-spring": { leaf: "#7cb342", vol: 0.5, bloom: 1 },
        "mid-spring": { leaf: "#689f38", vol: 0.5, bloom: 0.6 },
        "late-spring": { leaf: "#9e9d24", vol: 0.3 },
        "early-summer": { leaf: "#c0a43c", vol: 0 },
        "mid-summer": { leaf: "#c0a43c", vol: 0 },
        "mid-fall": { leaf: "#c0a43c", vol: 0 },
        winter: { leaf: "#c0a43c", vol: 0 },
      },
    ),
  },
  {
    id: "gk:peony",
    commonName: "Peony",
    botanicalName: "Paeonia lactiflora 'Sarah Bernhardt'",
    archetype: "flower",
    tags: ["pink", "fragrant", "long-lived", "full-sun", "spring-bloom"],
    displayPhase: "late-spring",
    forms: forms(
      {
        foliage: "lobed",
        bloom: "cluster",
        bloomColor: "#f48fb1",
        branch: { pattern: "clumping", density: 0.6, color: "#7a4b3a" },
      },
      {
        "mid-spring": { leaf: "#6b8f3e", vol: 0.7 },
        "late-spring": { leaf: "#396b2f", vol: 1, bloom: 1 },
        "early-summer": { leaf: "#396b2f", vol: 1, bloom: 0.3 },
        "mid-summer": { leaf: "#396b2f", vol: 1 },
        "mid-fall": { leaf: "#a3542f", vol: 0.7 },
        winter: { leaf: "#396b2f", vol: 0 },
      },
    ),
  },
  {
    id: "gk:salvia",
    commonName: "Salvia",
    botanicalName: "Salvia nemorosa 'May Night'",
    archetype: "flower",
    tags: ["purple", "pollinator", "drought-tolerant", "full-sun"],
    displayPhase: "late-spring",
    forms: forms(
      {
        foliage: "oval",
        bloom: "spike",
        bloomColor: "#5e35b1",
        branch: { pattern: "clumping", density: 0.7, color: "#4f7942" },
      },
      {
        "mid-spring": { leaf: "#4f7942", vol: 0.55 },
        "late-spring": { leaf: "#4f7942", vol: 0.9, bloom: 1 },
        "early-summer": { leaf: "#4f7942", vol: 1, bloom: 0.9 },
        "mid-summer": { leaf: "#446b3a", vol: 1, bloom: 0.5 },
        "early-fall": { leaf: "#446b3a", vol: 0.9, bloom: 0.4 },
        "mid-fall": { leaf: "#6d5c4b", vol: 0.4 },
        // Herbaceous border salvia dies back to the crown.
        winter: { leaf: "#6d5c4b", vol: 0 },
      },
    ),
  },
];

// ---------------------------------------------------------------------------
// Succulents
// ---------------------------------------------------------------------------

const SUCCULENTS: PlantSpecies[] = [
  {
    id: "gk:autumn-joy-sedum",
    commonName: "Autumn Joy Sedum",
    botanicalName: "Hylotelephium 'Herbstfreude'",
    archetype: "succulent",
    tags: ["pink", "drought-tolerant", "pollinator", "full-sun", "winter-interest"],
    displayPhase: "early-fall",
    forms: forms(
      {
        foliage: "oval",
        bloom: "cluster",
        bloomColor: "#e57390",
        branch: { pattern: "upright", density: 0.6, color: "#7fa86b" },
      },
      {
        "mid-spring": { leaf: "#93b881", vol: 0.5 },
        "late-spring": { leaf: "#93b881", vol: 0.7 },
        "mid-summer": { leaf: "#7fa86b", vol: 1, bloom: 0.2, flower: "#c8dba0" },
        "early-fall": { leaf: "#7fa86b", vol: 1, bloom: 1 },
        "mid-fall": { leaf: "#8a9b6e", vol: 0.7, bloom: 0.5, flower: "#a1453a" },
        // Fleshy foliage collapses after hard frost; dried heads are stems only.
        winter: { leaf: "#7a5c48", vol: 0 },
      },
    ),
  },
  {
    id: "gk:hens-and-chicks",
    commonName: "Hens and Chicks",
    botanicalName: "Sempervivum tectorum",
    archetype: "succulent",
    tags: ["evergreen", "drought-tolerant", "rock-garden", "full-sun"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "spiky",
        bloom: "star",
        bloomColor: "#e57390",
        branch: { pattern: "rosette", density: 0.8, color: "#4f6a45" },
      },
      {
        "mid-spring": { leaf: "#7a9b68", vol: 0.85 },
        "mid-summer": { leaf: "#6f9163", vol: 0.9, bloom: 0.15 },
        "mid-fall": { leaf: "#6f9163", vol: 0.85 },
        winter: { leaf: "#5f7a55", vol: 0.85 },
      },
    ),
  },
];

// ---------------------------------------------------------------------------
// Groundcovers
// ---------------------------------------------------------------------------

const GROUNDCOVERS: PlantSpecies[] = [
  {
    id: "gk:creeping-phlox",
    commonName: "Creeping Phlox",
    botanicalName: "Phlox subulata",
    archetype: "groundcover",
    tags: ["native", "pink", "spring-bloom", "evergreen", "full-sun", "slopes"],
    displayPhase: "mid-spring",
    forms: forms(
      {
        foliage: "needle",
        bloom: "star",
        bloomColor: "#f06eaa",
        branch: { pattern: "spreading", density: 0.7, color: "#3d6633" },
      },
      {
        "mid-spring": { leaf: "#5c8f4f", vol: 0.85, bloom: 1 },
        "late-spring": { leaf: "#5c8f4f", vol: 0.9, bloom: 0.5 },
        "mid-summer": { leaf: "#4c7a3d", vol: 0.9 },
        "mid-fall": { leaf: "#4c7a3d", vol: 0.85 },
        winter: { leaf: "#4a5d3a", vol: 0.8 },
      },
    ),
  },
  {
    id: "gk:pachysandra",
    commonName: "Pachysandra",
    botanicalName: "Pachysandra terminalis",
    archetype: "groundcover",
    tags: ["evergreen", "shade", "deer-resistant"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "oval",
        bloom: "spike",
        bloomColor: "#f1f1e6",
        branch: { pattern: "spreading", density: 0.6, color: "#3d6633" },
      },
      {
        "early-spring": { leaf: "#3e7c4f", vol: 0.9, bloom: 0.5 },
        "mid-spring": { leaf: "#3e7c4f", vol: 0.95 },
        "mid-summer": { leaf: "#3e7c4f", vol: 1 },
        "mid-fall": { leaf: "#3e7c4f", vol: 0.95 },
        winter: { leaf: "#39634a", vol: 0.9 },
      },
    ),
  },
];

// ---------------------------------------------------------------------------
// Vines
// ---------------------------------------------------------------------------

const VINES: PlantSpecies[] = [
  {
    id: "gk:clematis",
    commonName: "Clematis",
    botanicalName: "Clematis 'Jackmanii'",
    archetype: "vine",
    tags: ["purple", "climber", "full-sun", "long-blooming"],
    displayPhase: "early-summer",
    forms: forms(
      {
        foliage: "heart",
        bloom: "star",
        bloomColor: "#6a3ab2",
        branch: { pattern: "weeping", density: 0.7, color: "#5d4037" },
      },
      {
        "mid-spring": { leaf: "#7cb342", vol: 0.5 },
        "late-spring": { leaf: "#689f38", vol: 0.8, bloom: 0.3 },
        "early-summer": { leaf: "#558b2f", vol: 1, bloom: 1 },
        "mid-summer": { leaf: "#558b2f", vol: 1, bloom: 0.7 },
        "late-summer": { leaf: "#4c7a3d", vol: 1, bloom: 0.4 },
        "mid-fall": { leaf: "#689f38", vol: 0.7 },
        winter: { leaf: "#558b2f", vol: 0 },
      },
    ),
  },
  {
    id: "gk:english-ivy",
    commonName: "English Ivy",
    botanicalName: "Hedera helix",
    archetype: "vine",
    tags: ["evergreen", "shade", "climber", "vigorous"],
    displayPhase: "mid-summer",
    forms: forms(
      {
        foliage: "lobed",
        bloom: "dot",
        bloomColor: "#c5b358",
        branch: { pattern: "weeping", density: 0.8, color: "#3d5c35" },
      },
      {
        "mid-spring": { leaf: "#3a6b45", vol: 0.95 },
        "mid-summer": { leaf: "#2f5d3a", vol: 1 },
        "mid-fall": { leaf: "#2f5d3a", vol: 0.95 },
        winter: { leaf: "#2c4f34", vol: 0.95 },
      },
    ),
  },
];

// ---------------------------------------------------------------------------

export const BUILTIN_SPECIES: PlantSpecies[] = [
  ...TREES,
  ...SHRUBS,
  ...GRASSES,
  ...FLOWERS,
  ...SUCCULENTS,
  ...GROUNDCOVERS,
  ...VINES,
];

export const BUILTIN_SPECIES_BY_ID: ReadonlyMap<string, PlantSpecies> =
  new Map(BUILTIN_SPECIES.map((s) => [s.id, s]));
